import mongoose from "mongoose";

// Every risk check that runs gets logged here, for the analytics / trending view.
const checkSchema = new mongoose.Schema(
  {
    query: { type: String, required: true, trim: true },
    querySlug: { type: String, required: true, index: true },
    result: {
      riskScore: Number,
      riskLevel: String,
      status: String,
      category: String,
      redFlags: [String],
    },
    channel: { type: String, default: "whatsapp" },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Check", checkSchema);
