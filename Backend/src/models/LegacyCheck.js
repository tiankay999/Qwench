// DEPRECATED — replaced by the new data model. See src/models/Check.js.
//
// This is the original analytics row: it stores the raw query string, which
// the new model deliberately does not. It stays only so existing data can be
// read until Phase 6. Do not write new rows.
//
// Registered as "LegacyCheck" over the original `checks` collection, because
// the new Check model owns the name and lives in `check_events`.

import mongoose from "mongoose";

const legacyCheckSchema = new mongoose.Schema(
  {
    query: { type: String, required: true, trim: true },
    querySlug: { type: String, required: true, index: true },
    result: {
      riskScore: Number,
      riskLevel: String,
      riskVerdict: String,
      analyzedBy: String,
      status: String,
      category: String,
      redFlags: [String],
    },
    channel: { type: String, default: "whatsapp" },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("LegacyCheck", legacyCheckSchema, "checks");
