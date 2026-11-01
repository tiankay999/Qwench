import mongoose from "mongoose";

import { IDENTIFIER_TYPES } from "../lib/identifiers.js";

export const CASE_TYPES = ["scheme", "impersonation"];
export const CASE_STATUSES = ["open", "under_review", "referred", "confirmed", "dismissed", "closed"];

/** What opens a case automatically. */
export const CASE_TRIGGERS = {
  THREE_SOURCES: "three_independent_sources",
  SIGNAL_MATCHES_REPORT: "public_signal_matches_member_report",
  CHECK_SPIKE: "check_spike_flagged",
  REGISTERED_NAME_MISUSE: "number_advertised_under_registered_business",
  MANUAL: "manual",
};

const hashedIdentifierSchema = new mongoose.Schema(
  {
    type: { type: String, enum: IDENTIFIER_TYPES },
    valueHash: { type: String },
  },
  { _id: false }
);

const referralSchema = new mongoose.Schema(
  {
    // "CSA", "SEC Ghana", "Bank of Ghana"
    to: { type: String, trim: true },
    date: { type: Date, default: Date.now },
    reference: { type: String, trim: true },
  },
  { _id: false }
);

/**
 * An investigation file.
 *
 * The output of a case is an evidence pack for CSA, SEC Ghana, the Bank of
 * Ghana or law enforcement. Qwench does not contact, message or pay a suspect
 * — there is deliberately no field for doing so.
 */
const caseSchema = new mongoose.Schema(
  {
    // "QW-2026-0001"
    caseNumber: { type: String, required: true, unique: true, trim: true },
    type: { type: String, required: true, enum: CASE_TYPES },
    trigger: { type: String, required: true, trim: true },

    identifiers: { type: [hashedIdentifierSchema], default: [] },
    checks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Check" }],
    evidenceRefs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Source" }],

    tier: { type: Number, enum: [1, 2, 3, 4, null], default: null },
    status: { type: String, enum: CASE_STATUSES, default: "open" },
    referrals: { type: [referralSchema], default: [] },
    outcome: { type: String, trim: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// A referred case must record where it went, or the referral cannot be chased.
caseSchema.pre("validate", function requireReferralTrail() {
  if (this.status === "referred" && !(this.referrals || []).length) {
    throw (new Error("A case marked 'referred' must record at least one referral (to whom, and when)."));
  }
});

/** Next sequential case number for the year, e.g. QW-2026-0007. */
caseSchema.statics.nextCaseNumber = async function nextCaseNumber(year = new Date().getFullYear()) {
  const prefix = `QW-${year}-`;
  const last = await this.findOne({ caseNumber: new RegExp(`^${prefix}`) })
    .sort({ caseNumber: -1 })
    .select("caseNumber")
    .lean();

  const n = last ? Number(last.caseNumber.slice(prefix.length)) + 1 : 1;
  return prefix + String(n).padStart(4, "0");
};

caseSchema.index({ status: 1 });
caseSchema.index({ "identifiers.valueHash": 1 });
caseSchema.index({ createdAt: -1 });

export default mongoose.model("Case", caseSchema);
