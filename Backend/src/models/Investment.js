import mongoose from "mongoose";

export const STATUSES = ["authority", "licensed", "sandbox", "blacklisted", "revoked", "unknown"];
export const CATEGORIES = ["crypto", "forex", "ponzi", "investment", "real-estate", "other"];

const investmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // lowercased, suffix-stripped name used for lookups
    slug: { type: String, required: true, unique: true, index: true },
    // alternate spellings people might search for
    aliases: { type: [String], default: [], index: true },

    status: { type: String, enum: STATUSES, default: "unknown", index: true },
    // "SEC Ghana" | "SEC Ghana & EOCO" | "Qwench risk engine"
    source: { type: String, default: "" },
    // "Fund Manager" | "Broker-Dealer" | "Investment Advisor" -- licensed entities only
    licenseType: { type: String, default: "" },
    category: { type: String, enum: CATEGORIES, default: "other" },

    riskScore: { type: Number, min: 0, max: 10, default: 5 },
    redFlags: { type: [String], default: [] },

    // when the entity was flagged / added to the register
    dateAdded: { type: Date, default: Date.now },
    lastChecked: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Investment", investmentSchema);
