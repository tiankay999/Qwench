import mongoose from "mongoose";

import { EXACT_MATCH_ONLY, IDENTIFIER_TYPES, SENSITIVE_TYPES, normalizeName } from "../lib/identifiers.js";

export const IDENTIFIER_STATUSES = ["active", "expired", "disputed"];

/**
 * The matching table. When someone sends a number, domain, wallet or handle,
 * this is what it is looked up against.
 *
 * Phone, MoMo and bank numbers are stored as `valueHash` only -- `raw` is
 * blanked for those types by a hook below, so a database dump cannot be turned
 * back into a list of people's numbers.
 */
const identifierSchema = new mongoose.Schema(
  {
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: "Entity", required: true },
    type: { type: String, required: true, enum: IDENTIFIER_TYPES },

    // Original value as captured -- cleared for sensitive types
    raw: { type: String, default: "" },
    // Canonical form: +233 numbers, lowercased domains and EVM addresses
    normalized: { type: String, required: true },
    // HMAC-SHA256 of `${type}:${normalized}`
    valueHash: { type: String, required: true },

    // Numbers are matched exactly; only names and handles are fuzzy-eligible
    allowFuzzy: { type: Boolean, default: false },
    // Where this identifier was found
    origin: { type: String, trim: true },
    status: { type: String, enum: IDENTIFIER_STATUSES, default: "active" },
  },
  { timestamps: true }
);

/**
 * Two invariants enforced in code rather than left to the caller:
 *   1. a sensitive value never keeps its raw form
 *   2. names that collide with real global brands are never fuzzy-matched,
 *      so "Dallmayr" the coffee roaster is not swept into a Ghanaian notice
 */
identifierSchema.pre("validate", function enforceIdentifierSafety() {
  if (SENSITIVE_TYPES.has(this.type)) this.raw = "";

  if (this.allowFuzzy && EXACT_MATCH_ONLY.has(normalizeName(this.normalized))) {
    this.allowFuzzy = false;
  }
});

identifierSchema.index({ valueHash: 1 });
identifierSchema.index({ normalized: 1 });
identifierSchema.index({ entityId: 1 });
identifierSchema.index({ type: 1, valueHash: 1 });
// One identifier row per entity/type/value
identifierSchema.index({ entityId: 1, type: 1, valueHash: 1 }, { unique: true });

export default mongoose.model("Identifier", identifierSchema);
