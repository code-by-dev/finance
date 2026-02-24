import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["INCOME", "EXPENSE"],
    },
    amount: { type: Number, required: true },
    description: { type: String, default: null },
    date: { type: Date, required: true },
    category: { type: String, required: true },
    receiptUrl: { type: String, default: null },
    isRecurring: { type: Boolean, default: false },
    recurringInterval: {
      type: String,
      enum: ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"],
      default: null,
    },
    nextRecurringDate: { type: Date, default: null },
    lastProcessed: { type: Date, default: null },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "COMPLETED",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1 });
transactionSchema.index({ accountId: 1 });

export default mongoose.models.Transaction ||
  mongoose.model("Transaction", transactionSchema);
