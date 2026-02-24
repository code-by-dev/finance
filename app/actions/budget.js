"use server";

import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { User, Budget, Transaction } from "@/models";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getCurrentBudget(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    await connectDB();

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) throw new Error("User not found");

    const budget = await Budget.findOne({ userId: user._id }).lean();

    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );

    const result = await Transaction.aggregate([
      {
        $match: {
          userId: user._id,
          type: "EXPENSE",
          date: { $gte: startOfMonth, $lte: endOfMonth },
          accountId: mongoose.Types.ObjectId.isValid(accountId)
            ? new mongoose.Types.ObjectId(accountId)
            : accountId,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const currentExpenses = result[0]?.total ?? 0;

    return {
      budget: budget
        ? { ...budget, id: budget._id?.toString(), amount: Number(budget.amount) }
        : null,
      currentExpenses: Number(currentExpenses),
    };
  } catch (error) {
    console.error("Error fetching budget:", error);
    throw error;
  }
}

export async function updateBudget(amount) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    await connectDB();

    const user = await User.findOne({ clerkUserId: userId });
    if (!user) throw new Error("User not found");

    const budget = await Budget.findOneAndUpdate(
      { userId: user._id },
      { $set: { amount } },
      { new: true, upsert: true }
    );

    revalidatePath("/dashboard");
    return {
      success: true,
      data: { ...budget.toObject(), id: budget._id.toString(), amount: Number(budget.amount) },
    };
  } catch (error) {
    console.error("Error updating budget:", error);
    return { success: false, error: error.message };
  }
}
