import mongoose from "mongoose";

const budgetSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    lastAlertSent: { type: Date, default: null },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Budget || mongoose.model("Budget", budgetSchema);
