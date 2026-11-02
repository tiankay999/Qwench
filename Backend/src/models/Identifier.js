import mongoose from "mongoose";

import { EXACT_MATCH_ONLY, IDENTIFIER_TYPES, SENSITIVE_TYPES, normalizeName } from "../lib/identifiers.js";

export const IDENTIFIER_STATUSES = ["active", "expired", "disputed"];
export const IDENTIFIER_ORIGINS = ["notice", "partner", "merchant", "review", "legacy"];

/**
 * The matching table. When someone sends a number, domain, wallet or handle,
 * this is what it is looked up against.
 *
 * Anything from a partner, and any MoMo or bank number not published in a
 * regulator's notice, is stored as `valueHash` only. A hook below blanks `raw` and
 * `normalized`, so a database dump cannot be turned back into a list of numbers.
 * A number in a notice is already public, and stays readable for the feed.
 */
const identifierSchema = new mongoose.Schema(
  {
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: "Entity", required: true },
    type: { type: String, required: true, enum: IDENTIFIER_TYPES },

    // Original value as captured -- never kept for numbers or partner data
    raw: { type: String, default: "" },
    // Canonical form: +233 numbers, lowercased domains and EVM addresses.
    // Empty when the value is stored as a hash only.
    normalized: { type: String, default: "" },
    // HMAC-SHA256 of `${type}:${normalized}`
    valueHash: { type: String, required: true },

    // Numbers are matched exactly; only names and handles are fuzzy-eligible
    allowFuzzy: { type: Boolean, default: false },
    // Where this identifier was found
    origin: { type: String, enum: IDENTIFIER_ORIGINS },
    status: { type: String, enum: IDENTIFIER_STATUSES, default: "active" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/**
 * Two invariants enforced in code rather than left to the caller:
 *   1. partner data and unpublished numbers keep no readable form
 *   2. names that collide with real global brands are never fuzzy-matched,
 *      so "Dallmayr" the coffee roaster is not swept into a Ghanaian notice
 */
identifierSchema.pre("validate", function enforceIdentifierSafety() {
  if (SENSITIVE_TYPES.has(this.type)) this.raw = "";

  if (this.origin === "partner" || (SENSITIVE_TYPES.has(this.type) && this.origin !== "notice")) {
    this.raw = "";
    this.normalized = "";
    this.allowFuzzy = false;
  }

  if (this.allowFuzzy && EXACT_MATCH_ONLY.has(normalizeName(this.normalized))) {
    this.allowFuzzy = false;
  }
});

/** Query updates skip the hook above, so readable values can only change through save(). */
function refuseReadableUpdate() {
  const update = this.getUpdate();
  const fields = Array.isArray(update) ? null : { ...update, ...update?.$set, ...update?.$setOnInsert };

  if (!fields || fields.raw || fields.normalized) {
    throw new Error("Change an identifier's readable values with document.save(), so numbers stay hash only.");
  }
}

for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"]) {
  identifierSchema.pre(op, refuseReadableUpdate);
}

identifierSchema.index({ valueHash: 1 });
identifierSchema.index({ normalized: 1 });
identifierSchema.index({ entityId: 1 });
identifierSchema.index({ type: 1, valueHash: 1 });
// One identifier row per entity/type/value
identifierSchema.index({ entityId: 1, type: 1, valueHash: 1 }, { unique: true });

export default mongoose.model("Identifier", identifierSchema);
