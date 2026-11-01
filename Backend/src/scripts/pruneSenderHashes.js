import "dotenv/config";

import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import { Check } from "../models/index.js";

/**
 * Clears sender hashes older than 24 hours.
 *
 * This exists instead of a TTL index because a TTL index deletes the whole
 * document, which would destroy the check history the Signal and Case
 * pipelines are built from. Only the sender hash is supposed to expire.
 *
 * Run on a schedule (hourly is plenty):
 *   node src/scripts/pruneSenderHashes.js
 */
export async function pruneSenderHashes() {
  const cutoff = new Date();

  const res = await Check.updateMany(
    {
      senderHash: { $ne: null },
      $or: [{ senderHashExpiresAt: { $lte: cutoff } }, { senderHashExpiresAt: null, createdAt: { $lte: new Date(cutoff - 86_400_000) } }],
    },
    { $set: { senderHash: null, senderHashExpiresAt: null } }
  );

  if (res.modifiedCount) {
    console.log(`[prune] cleared ${res.modifiedCount} sender hash(es) older than 24h`);
  } else {
    console.log("[prune] nothing to clear");
  }

  return res.modifiedCount;
}

// Only run standalone when invoked directly, not when imported by a scheduler.
if (process.argv[1] && process.argv[1].endsWith("pruneSenderHashes.js")) {
  await connectDB();
  await pruneSenderHashes();
  await mongoose.disconnect();
  process.exit(0);
}
