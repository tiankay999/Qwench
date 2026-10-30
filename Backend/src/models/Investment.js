import mongoose from "mongoose";

const investmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // lowercased name used for lookups
    slug: { type: String, required: true, unique: true, index: true },
    aliases: { type: [String], default: [] },
    type: {
      type: String,
      enum: ["crypto", "forex", "ponzi", "real-estate", "other"],
      default: "other",
    },
    riskScore: { type: Number, min: 0, max: 10, default: 5 },
    secStatus: {
      type: String,
      enum: ["licensed", "not-licensed", "warned", "unknown"],
      default: "unknown",
    },
    secLicenseNumber: { type: String, default: "" },
    secNote: { type: String, default: "" },
    redFlags: { type: [String], default: [] },
    yearStarted: { type: Number, default: null },
    website: { type: String, default: "" },
    lastChecked: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Investment", investmentSchema);
