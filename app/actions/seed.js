"use server";

import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User, Account, Transaction } from "@/models";
import { subDays } from "date-fns";

function isMongoTransactionsNotSupported(error) {
  const msg = error?.message ?? "";
  return (
    msg.includes("Transaction numbers are only allowed on a replica set member") ||
    msg.includes("replica set member or mongos")
  );
}

const CATEGORIES = {
  INCOME: [
    { name: "salary", range: [5000, 8000] },
    { name: "freelance", range: [1000, 3000] },
    { name: "investments", range: [500, 2000] },
    { name: "other-income", range: [100, 1000] },
  ],
  EXPENSE: [
    { name: "housing", range: [1000, 2000] },
    { name: "transportation", range: [100, 500] },
    { name: "groceries", range: [200, 600] },
    { name: "utilities", range: [100, 300] },
    { name: "entertainment", range: [50, 200] },
    { name: "food", range: [50, 150] },
    { name: "shopping", range: [100, 500] },
    { name: "healthcare", range: [100, 1000] },
    { name: "education", range: [200, 1000] },
    { name: "travel", range: [500, 2000] },
  ],
};

function getRandomAmount(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function getRandomCategory(type) {
  const categories = CATEGORIES[type];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const amount = getRandomAmount(category.range[0], category.range[1]);
  return { category: category.name, amount };
}

export async function seedTransactions() {
  try {
    await connectDB();

    const user = await User.findOne();
    if (!user) {
      return { success: false, error: "No user found. Create a user first." };
    }
    const account = await Account.findOne({ userId: user._id });
    if (!account) {
      return { success: false, error: "No account found. Create an account first." };
    }

    const transactions = [];
    let totalBalance = 0;

    for (let i = 90; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const transactionsPerDay = Math.floor(Math.random() * 3) + 1;

      for (let j = 0; j < transactionsPerDay; j++) {
        const type = Math.random() < 0.4 ? "INCOME" : "EXPENSE";
        const { category, amount } = getRandomCategory(type);

        transactions.push({
          type,
          amount,
          description: `${type === "INCOME" ? "Received" : "Paid for"} ${category}`,
          date,
          category,
          status: "COMPLETED",
          userId: user._id,
          accountId: account._id,
        });

        totalBalance += type === "INCOME" ? amount : -amount;
      }
    }

    try {
      const session = await mongoose.connection.startSession();
      try {
        await session.withTransaction(async () => {
          await Transaction.deleteMany({ accountId: account._id }, { session });
          await Transaction.insertMany(transactions, { session });
          await Account.updateOne(
            { _id: account._id },
            { $set: { balance: totalBalance } },
            { session }
          );
        });
      } finally {
        await session.endSession();
      }
    } catch (txnError) {
      if (!isMongoTransactionsNotSupported(txnError)) throw txnError;

      await Transaction.deleteMany({ accountId: account._id });
      await Transaction.insertMany(transactions);
      await Account.updateOne(
        { _id: account._id },
        { $set: { balance: totalBalance } }
      );
    }

    return {
      success: true,
      message: `Created ${transactions.length} transactions`,
    };
  } catch (error) {
    console.error("Error seeding transactions:", error);
    return { success: false, error: error.message };
  }
}
