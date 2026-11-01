import mongoose from "mongoose";

export const VERIFICATION_METHODS = ["company_registration", "merchant_account", "bank_confirmation"];
export const MERCHANT_STATUSES = ["pending", "verified", "suspended", "expired"];

/**
 * A business that has registered its official numbers and domains with proof
 * of ownership.
 *
 * Two rules this registry exists to uphold:
 *   - a result says "Registered by <business>", never "safe". Registration
 *     proves who controls a number, not that a deal is sound.
 *   - a business that has not registered gets "no claim", not a negative.
 *     Most legitimate traders will never register, and treating absence as
 *     suspicion would flag half of Ghana's small businesses.
 */
const merchantSchema = new mongoose.Schema(
  {
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: "Entity", required: true },
    legalName: { type: String, required: true, trim: true },
    verificationMethod: { type: String, enum: VERIFICATION_METHODS },
    documentRefs: [{ type: String }],
    officialIdentifiers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Identifier" }],

    status: { type: String, enum: MERCHANT_STATUSES, default: "pending" },
    // A person approves a merchant; this is never automatic
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    renewalDue: { type: Date },
  },
  { timestamps: true }
);

// Verification is a human decision, so it cannot be set without naming who made it.
merchantSchema.pre("validate", function requireHumanVerifier() {
  if (this.status === "verified" && !this.verifiedBy) {
    throw (new Error("A merchant can only be marked verified by a named user — set verifiedBy."));
  }
  if (this.status === "verified" && !this.verifiedAt) this.verifiedAt = new Date();
});

/** Wording for a result line. Never returns the word "safe". */
merchantSchema.methods.claimLine = function claimLine() {
  return this.status === "verified"
    ? `Registered by ${this.legalName}`
    : "No registration claim for this number";
};

merchantSchema.index({ entityId: 1 });
merchantSchema.index({ status: 1 });
merchantSchema.index({ renewalDue: 1 }, { sparse: true });

export default mongoose.model("Merchant", merchantSchema);
