import mongoose from "mongoose";

/** When each source last worked, so a broken one gets noticed. */
const collectorRunSchema = new mongoose.Schema({
  collector: { type: String, required: true, unique: true },
  lastRunAt: { type: Date, default: null },
  lastSuccessAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  lastNewNotices: { type: Number, default: 0 },
});

export default mongoose.model("CollectorRun", collectorRunSchema);
