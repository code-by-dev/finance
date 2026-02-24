"use server";

import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User, Account, Transaction } from "@/models";
import { toPlain } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

function isMongoTransactionsNotSupported(error) {
  const msg = error?.message ?? "";
  return (
    msg.includes("Transaction numbers are only allowed on a replica set member") ||
    msg.includes("replica set member or mongos")
  );
}

const serializeDecimal = (doc) => {
  const out = toPlain(doc);
  if (!out) return out;
  if (out.balance != null) out.balance = Number(out.balance);
  if (out.amount != null) out.amount = Number(out.amount);
  return out;
};

export async function getAccountWithTransactions(accountId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await connectDB();

  const user = await User.findOne({ clerkUserId: userId });
  if (!user) throw new Error("User not found");

  const account = await Account.findOne({
    _id: accountId,
    userId: user._id,
  }).lean();

  if (!account) return null;

  const transactions = await Transaction.find({
    accountId: account._id,
  })
    .sort({ date: -1 })
    .lean();

  const count = transactions.length;

  return {
    ...serializeDecimal(account),
    transactions: transactions.map(serializeDecimal),
    _count: { transactions: count },
  };
}

export async function bulkDeleteTransactions(transactionIds) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    await connectDB();

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) throw new Error("User not found");

    const transactions = await Transaction.find({
      _id: { $in: transactionIds },
      userId: user._id,
    }).lean();

    const accountBalanceChanges = transactions.reduce((acc, transaction) => {
      const change =
        transaction.type === "EXPENSE"
          ? Number(transaction.amount)
          : -Number(transaction.amount);
      const aid = transaction.accountId?.toString?.() ?? transaction.accountId;
      acc[aid] = (acc[aid] || 0) + change;
      return acc;
    }, {});

    try {
      const session = await mongoose.connection.startSession();
      await session.withTransaction(async () => {
        await Transaction.deleteMany(
          { _id: { $in: transactionIds }, userId: user._id },
          { session }
        );
        for (const [accountId, balanceChange] of Object.entries(
          accountBalanceChanges
        )) {
          await Account.updateOne(
            { _id: accountId },
            { $inc: { balance: balanceChange } },
            { session }
          );
        }
      });
      await session.endSession();
    } catch (txnError) {
      if (!isMongoTransactionsNotSupported(txnError)) throw txnError;

      await Transaction.deleteMany({ _id: { $in: transactionIds }, userId: user._id });
      for (const [accountId, balanceChange] of Object.entries(accountBalanceChanges)) {
        await Account.updateOne({ _id: accountId }, { $inc: { balance: balanceChange } });
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/account/[id]");

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateDefaultAccount(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    await connectDB();

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) throw new Error("User not found");

    await Account.updateMany(
      { userId: user._id, isDefault: true },
      { $set: { isDefault: false } }
    );

    const account = await Account.findOneAndUpdate(
      { _id: accountId, userId: user._id },
      { $set: { isDefault: true } },
      { new: true }
    );

    revalidatePath("/dashboard");
    return { success: true, data: serializeDecimal(account) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
