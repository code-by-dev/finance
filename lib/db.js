import { connectDB } from "./mongodb";
import { User, Account, Transaction, Budget } from "@/models";

export async function getDb() {
  await connectDB();
  return { User, Account, Transaction, Budget };
}

// Helper to serialize values for Client Components (remove ObjectId/Date objects)
export function toPlain(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject({ depopulate: true }) : doc;

  // Next.js RSC requires plain JSON-serializable values.
  // This converts ObjectId/Date/etc into strings.
  const jsonSafe = JSON.parse(JSON.stringify(obj));

  if (jsonSafe._id && !jsonSafe.id) jsonSafe.id = jsonSafe._id;
  delete jsonSafe._id;

  return jsonSafe;
}
