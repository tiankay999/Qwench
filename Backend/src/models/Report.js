import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    schemeName: { type: String, required: true, trim: true },
    schemeSlug: { type: String, required: true, index: true },
    schemeType: {
      type: String,
      enum: ["crypto", "forex", "ponzi", "investment", "real-estate", "other"],
      default: "other",
    },
    source: {
      type: String,
      enum: ["whatsapp", "social-media", "friend", "other"],
      default: "other",
    },
    description: { type: String, default: "" },
    // sha256 of the phone number -- we never store the raw number
    reporterPhone: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "investigating", "confirmed", "resolved"],
      default: "pending",
    },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Report", reportSchema);
