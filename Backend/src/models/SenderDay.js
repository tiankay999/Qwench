import mongoose from "mongoose";

/**
 * How many checks one sender has made today, for the fair-use limit.
 *
 * The hash uses a daily salt, so a sender cannot be followed across days, and
 * the TTL index deletes each row after 24 hours. Nothing links a row to what the
 * sender checked: check_events holds no sender at all.
 */
const senderDaySchema = new mongoose.Schema({
  senderHash: { type: String, required: true },
  // "2026-11-01"
  day: { type: String, required: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

senderDaySchema.index({ senderHash: 1, day: 1 }, { unique: true });
senderDaySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("SenderDay", senderDaySchema);
