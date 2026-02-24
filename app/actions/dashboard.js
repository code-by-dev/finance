"use server";

import aj from "@/lib/arcjet";
import { connectDB } from "@/lib/mongodb";
import { User, Account, Transaction } from "@/models";
import { toPlain } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

const getRequest = async () => {
  if (process.env.NODE_ENV === "development") {
    return { url: "http://localhost:3000", method: "POST" };
  }
  const { request } = await import("@arcjet/next");
  return request();
};

const serializeAccount = (doc) => {
  const obj = toPlain(doc);
  if (!obj) return obj;
  if (obj.balance != null) obj.balance = Number(obj.balance);
  return obj;
};

export async function getUserAccounts() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await connectDB();

  const user = await User.findOne({ clerkUserId: userId });
  if (!user) throw new Error("User not found");

  try {
    const accounts = await Account.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .lean();

    const withCount = await Promise.all(
      accounts.map(async (acc) => {
        const count = await Transaction.countDocuments({ accountId: acc._id });
        return { ...acc, _count: { transactions: count } };
      })
    );

    return withCount.map(serializeAccount);
  } catch (error) {
    console.error(error.message);
  }
}

export async function createAccount(data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Get request data for ArcJet, fail open in dev or on timeout
    try {
      const req = await getRequest();
      const decision = await aj.protect(req, {
        userId,
        requested: 1, // Specify how many tokens to consume
      });

      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          const { remaining, reset } = decision.reason;
          console.error({
            code: "RATE_LIMIT_EXCEEDED",
            details: {
              remaining,
              resetInSeconds: reset,
            },
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

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) throw new Error("User not found");

    const balanceFloat = parseFloat(data.balance);
    if (isNaN(balanceFloat)) throw new Error("Invalid balance amount");

    const existingAccounts = await Account.find({ userId: user._id });
    const shouldBeDefault =
      existingAccounts.length === 0 ? true : data.isDefault;

    if (shouldBeDefault) {
      await Account.updateMany(
        { userId: user._id, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const account = await Account.create({
      ...data,
      balance: balanceFloat,
      userId: user._id,
      isDefault: shouldBeDefault,
    });

    const serializedAccount = serializeAccount(account);

    revalidatePath("/dashboard");
    return { success: true, data: serializedAccount };
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function getDashboardData() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await connectDB();

  const user = await User.findOne({ clerkUserId: userId });
  if (!user) throw new Error("User not found");

  const transactions = await Transaction.find({ userId: user._id })
    .sort({ date: -1 })
    .lean();

  return transactions.map((t) => ({
    ...toPlain(t),
    amount: Number(t.amount),
  }));
}
