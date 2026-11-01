import "dotenv/config";

import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import { Check } from "../models/index.js";

/**
 * One-off cleanup for a database that ran an earlier version of the check log.
 *
 * check_events no longer holds a sender or an exact time, so this removes those
 * fields from rows written before that change. It works on the raw collection
 * because the fields are no longer in the schema. Run it once:
 *
 *   node src/scripts/pruneSenderHashes.js
 */
export async function pruneSenderHashes() {
  const res = await Check.collection.updateMany(
    {},
    { $unset: { senderHash: "", senderHashExpiresAt: "", createdAt: "", updatedAt: "" } }
  );

  console.log(`[prune] cleaned ${res.modifiedCount} check event(s)`);
  return res.modifiedCount;
}

// Only run standalone when invoked directly, not when imported.
if (process.argv[1] && process.argv[1].endsWith("pruneSenderHashes.js")) {
  await connectDB();
  await pruneSenderHashes();
  await mongoose.disconnect();
  process.exit(0);
}
