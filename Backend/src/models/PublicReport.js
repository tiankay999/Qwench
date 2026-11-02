import mongoose from "mongoose";

import { IDENTIFIER_TYPES } from "../lib/identifiers.js";

export const PUBLIC_REPORT_SOURCES = ["whatsapp", "telegram", "web"];
export const PUBLIC_REPORT_STATUSES = ["pending", "under_review", "confirmed", "dismissed"];
export const UNCONFIRMED_REPORT_DAYS = 90;

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
    // Many reports from one channel: worth a closer look. It changes no result.
    volumeFlag: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
    // _id of the row this came from in the old `reports` collection. Gives the
    // migration a stable key so re-running updates instead of duplicating. Absent
    // on new reports.
    legacyId: { type: mongoose.Schema.Types.ObjectId },
    // Deleted by the TTL index below. Null once confirmed, which keeps the report.
    expiresAt: { type: Date, default: () => new Date(Date.now() + UNCONFIRMED_REPORT_DAYS * 86_400_000) },
  },
  { timestamps: true }
);

publicReportSchema.pre("validate", function keepConfirmedReports() {
  if (this.reviewStatus === "confirmed") this.expiresAt = null;
});

/**
 * A single public report is tier "None". It is evidence that something is
 * worth looking at, not evidence that the scheme is fraudulent.
 */
publicReportSchema.methods.evidenceTier = function evidenceTier() {
  return null;
};

publicReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
publicReportSchema.index({ reviewStatus: 1 });
publicReportSchema.index({ schemeName: "text" });
publicReportSchema.index({ "identifiers.valueHash": 1 });
publicReportSchema.index({ createdAt: -1 });
// Partial, not sparse: rows written before the default was removed can hold an
// explicit null, which a sparse index would still collide on. Only real ObjectIds
// are indexed here.
publicReportSchema.index(
  { legacyId: 1 },
  { unique: true, partialFilterExpression: { legacyId: { $type: "objectId" } } }
);

export default mongoose.model("PublicReport", publicReportSchema);
