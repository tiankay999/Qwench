import mongoose from "mongoose";

import { IDENTIFIER_TYPES } from "../lib/identifiers.js";

export const PUBLIC_REPORT_SOURCES = ["whatsapp", "telegram", "web"];
export const PUBLIC_REPORT_STATUSES = ["pending", "under_review", "confirmed", "dismissed"];

const hashedIdentifierSchema = new mongoose.Schema(
  {
    type: { type: String, enum: IDENTIFIER_TYPES },
    valueHash: { type: String },
  },
  { _id: false }
);

/**
 * A report from a member of the public. Replaces the old Report model.
 *
 * Never shown publicly and never a verdict on its own: one report opens a
 * review, nothing more. Publishing unverified public reports would let anyone
 * smear a competitor through Qwench.
 */
const publicReportSchema = new mongoose.Schema(
  {
    schemeName: { type: String, required: true, trim: true },
    identifiers: { type: [hashedIdentifierSchema], default: [] },
    source: { type: String, enum: PUBLIC_REPORT_SOURCES },
    evidenceRefs: [{ type: String }],
    reviewStatus: { type: String, enum: PUBLIC_REPORT_STATUSES, default: "pending" },
    // _id of the row this came from in the old `reports` collection. Gives the
    // migration a stable key so re-running updates instead of duplicating.
    legacyId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

/**
 * A single public report is tier "None". It is evidence that something is
 * worth looking at, not evidence that the scheme is fraudulent.
 */
publicReportSchema.methods.evidenceTier = function evidenceTier() {
  return null;
};

publicReportSchema.index({ reviewStatus: 1 });
publicReportSchema.index({ schemeName: "text" });
publicReportSchema.index({ "identifiers.valueHash": 1 });
publicReportSchema.index({ createdAt: -1 });
publicReportSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

export default mongoose.model("PublicReport", publicReportSchema);
