"use server";

import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User, Account, Transaction } from "@/models";
import { toPlain } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";
import aj from "@/lib/arcjet";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const getRequest = async () => {
  if (process.env.NODE_ENV === "development") {
    return { url: "http://localhost:3000", method: "POST" };
  }
  const { request } = await import("@arcjet/next");
  return request();
};

const serializeAmount = (doc) => ({
  ...toPlain(doc),
  amount: doc?.amount != null ? Number(doc.amount) : undefined,
});

function isMongoTransactionsNotSupported(error) {
  const msg = error?.message ?? "";
  return (
    msg.includes("Transaction numbers are only allowed on a replica set member") ||
    msg.includes("replica set member or mongos")
  );
}

async function runOptionalTransaction(work) {
  const session = await mongoose.connection.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}

function calculateNextRecurringDate(startDate, interval) {
  const date = new Date(startDate);
  switch (interval) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      break;
    case "YEARLY":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  return date;
}

export async function createTransaction(data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
      const req = await getRequest();
      const decision = await aj.protect(req, { userId, requested: 1 });
      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          const { remaining, reset } = decision.reason;
          console.error({
            code: "RATE_LIMIT_EXCEEDED",
            details: { remaining, resetInSeconds: reset },
          });
          throw new Error("Too many requests. Please try again later.");
        }
        throw new Error("Request blocked");
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Arcjet decision failed; continuing in dev:", e?.message || e);
      } else {
        throw e;
      }
    }

    await connectDB();

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) throw new Error("User not found");

    const account = await Account.findOne({
      _id: data.accountId,
      userId: user._id,
    });
    if (!account) throw new Error("Account not found");

    const balanceChange = data.type === "EXPENSE" ? -data.amount : data.amount;
    const newBalance = Number(account.balance) + balanceChange;

    try {
      await runOptionalTransaction(async (session) => {
        await Transaction.create(
          [
            {
              ...data,
              userId: user._id,
              accountId: account._id,
              nextRecurringDate:
                data.isRecurring && data.recurringInterval
                  ? calculateNextRecurringDate(data.date, data.recurringInterval)
                  : null,
            },
          ],
          { session }
        );
        await Account.updateOne(
          { _id: data.accountId },
          { $set: { balance: newBalance } },
          { session }
        );
      });
    } catch (txnError) {
      if (!isMongoTransactionsNotSupported(txnError)) throw txnError;

      // Fallback for standalone MongoDB (no replica set): do sequential writes.
      await Transaction.create({
        ...data,
        userId: user._id,
        accountId: account._id,
        nextRecurringDate:
          data.isRecurring && data.recurringInterval
            ? calculateNextRecurringDate(data.date, data.recurringInterval)
            : null,
      });
      await Account.updateOne(
        { _id: data.accountId },
        { $set: { balance: newBalance } }
      );
    }

    const newTransaction = await Transaction.findOne({
      userId: user._id,
      accountId: account._id,
      date: data.date,
      amount: data.amount,
    })
      .sort({ createdAt: -1 })
      .lean();

    revalidatePath("/dashboard");
    revalidatePath(`/account/${data.accountId}`);

    return { success: true, data: serializeAmount(newTransaction) };
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function getTransaction(id) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await connectDB();

  const user = await User.findOne({ clerkUserId: userId });
  if (!user) throw new Error("User not found");

  const transaction = await Transaction.findOne({
    _id: id,
    userId: user._id,
  }).lean();

  if (!transaction) throw new Error("Transaction not found");
  return serializeAmount(transaction);
}

export async function updateTransaction(id, data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    await connectDB();

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) throw new Error("User not found");

    const originalTransaction = await Transaction.findOne({
      _id: id,
      userId: user._id,
    }).lean();

    if (!originalTransaction) throw new Error("Transaction not found");

    const oldBalanceChange =
      originalTransaction.type === "EXPENSE"
        ? -Number(originalTransaction.amount)
        : Number(originalTransaction.amount);
    const newBalanceChange =
      data.type === "EXPENSE" ? -data.amount : data.amount;
    const netBalanceChange = newBalanceChange - oldBalanceChange;

    try {
      await runOptionalTransaction(async (session) => {
        await Transaction.updateOne(
          { _id: id, userId: user._id },
          {
            $set: {
              ...data,
              nextRecurringDate:
                data.isRecurring && data.recurringInterval
                  ? calculateNextRecurringDate(data.date, data.recurringInterval)
                  : null,
            },
          },
          { session }
        );
        await Account.updateOne(
          { _id: data.accountId },
          { $inc: { balance: netBalanceChange } },
          { session }
        );
      });
    } catch (txnError) {
      if (!isMongoTransactionsNotSupported(txnError)) throw txnError;

      // Fallback for standalone MongoDB (no replica set): do sequential writes.
      await Transaction.updateOne(
        { _id: id, userId: user._id },
        {
          $set: {
            ...data,
            nextRecurringDate:
              data.isRecurring && data.recurringInterval
                ? calculateNextRecurringDate(data.date, data.recurringInterval)
                : null,
          },
        }
      );
      await Account.updateOne(
        { _id: data.accountId },
        { $inc: { balance: netBalanceChange } }
      );
    }

    const transaction = await Transaction.findOne({
      _id: id,
      userId: user._id,
    }).lean();

    revalidatePath("/dashboard");
    revalidatePath(`/account/${data.accountId}`);

    return { success: true, data: serializeAmount(transaction) };
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function getUserTransactions(query = {}) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    await connectDB();

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) throw new Error("User not found");

    const transactions = await Transaction.find({
      userId: user._id,
      ...query,
    })
      .populate("accountId")
      .sort({ date: -1 })
      .lean();

    return { success: true, data: transactions };
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function scanReceipt(file) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const arrayBuffer = await file.arrayBuffer();
    const base64String = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `
      Analyze this receipt image and extract the following information in JSON format:
      - Total amount (just the number)
      - Date (in ISO format)
      - Description or items purchased (brief summary)
      - Merchant/store name
      - Suggested category (one of: housing,transportation,groceries,utilities,entertainment,food,shopping,healthcare,education,personal,travel,insurance,gifts,bills,other-expense )
      
      Only respond with valid JSON in this exact format:
      {
        "amount": number,
        "date": "ISO date string",
        "description": "string",
        "merchantName": "string",
        "category": "string"
      }

      If its not a recipt, return an empty object
    `;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    try {
      const data = JSON.parse(cleanedText);
      return {
        amount: parseFloat(data.amount),
        date: new Date(data.date),
        description: data.description,
        category: data.category,
        merchantName: data.merchantName,
      };
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      throw new Error("Invalid response format from Gemini");
    }
  } catch (error) {
    console.error("Error scanning receipt:", error);
    throw new Error("Failed to scan receipt");
  }
}
