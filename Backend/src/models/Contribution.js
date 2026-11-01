import mongoose from "mongoose";

import { IDENTIFIER_TYPES } from "../lib/identifiers.js";

export const CONTRIBUTION_REVIEW_STATUSES = ["pending", "reviewed", "rejected"];

/** Hashed identifiers only -- never the number itself. */
const hashedIdentifierSchema = new mongoose.Schema(
  {
    type: { type: String, enum: IDENTIFIER_TYPES },
    valueHash: { type: String },
  },
  { _id: false }
);

/**
 * Scheme details shared by a member organisation.
 *
 * What is never shared, and therefore has no field here: customer details,
 * the contents of a suspicious transaction report, or which organisation
 * contributed a given detail once it is pooled.
 */
const contributionSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    schemeName: { type: String, required: true, trim: true },
    identifiers: { type: [hashedIdentifierSchema], default: [] },

    // "15% daily", "task-based"
    terms: { type: String, trim: true },
    // "Greater Accra", "Ashanti"
    region: { type: String, trim: true },
    // "< GHS 1000", "GHS 1000-5000", "> GHS 5000"
    lossBand: { type: String, trim: true },

    evidenceRefs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Source" }],
    reviewStatus: { type: String, enum: CONTRIBUTION_REVIEW_STATUSES, default: "pending" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// A contribution carrying an unhashed identifier would leak a customer's
// number into the shared pool, so reject it rather than storing it.
contributionSchema.pre("validate", function requireHashedIdentifiers() {
  for (const id of this.identifiers || []) {
    if (id.valueHash && !/^[a-f0-9]{64}$/i.test(id.valueHash)) {
      throw (
        new Error("Contribution identifiers must be HMAC-SHA256 hashes — never a raw number. Use buildIdentifier().")
      );
    }
  }
});

contributionSchema.index({ orgId: 1, reviewStatus: 1 });
contributionSchema.index({ schemeName: 1, reviewStatus: 1 });
contributionSchema.index({ "identifiers.valueHash": 1 });
contributionSchema.index({ schemeName: "text" });

export default mongoose.model("Contribution", contributionSchema);
