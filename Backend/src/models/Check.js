import mongoose from "mongoose";

export const CHECK_CHANNELS = ["whatsapp", "telegram", "web", "api"];
export const CHECK_INPUT_TYPES = ["name", "number", "domain", "wallet", "url", "image"];
export const CHECK_STATES = ["named_in_notice", "licensed", "sandbox", "registered", "authority", "no_record"];
export const CHECK_OUTCOMES = ["warn", "warn_or_confirmation_call", "internal_review", "watch", "none"];

/**
 * One row per lookup, kept for aggregation and for the Signal/Case pipeline.
 *
 * Privacy rules, enforced below rather than left to callers:
 *   - no raw query text is ever stored, only hashes of what was looked up
 *   - no phone numbers or message bodies
 *   - no sender and no exact time: only the hour, so a row cannot be tied back
 *     to the person who asked. There are deliberately no timestamps here.
 *
 * Collection note: this lives in `check_events`, not `checks`. The previous
 * Check model (now LegacyCheck) still owns `checks` and has an incompatible
 * shape, so the two are kept apart until the old collection is retired.
 */
const checkSchema = new mongoose.Schema(
  {
    // "2026-11-01T14"
    hourBucket: { type: String, required: true },
    channel: { type: String, required: true, enum: CHECK_CHANNELS },
    inputType: { type: String, required: true, enum: CHECK_INPUT_TYPES },

    identifierHashes: [{ type: String }],
    matchedEntityIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Entity" }],

    state: { type: String, enum: CHECK_STATES },
    // Evidence tier; null when nothing matched
    tier: { type: Number, enum: [1, 2, 3, 4, null], default: null },
    flags: [{ type: String }],

    outcome: { type: String, enum: CHECK_OUTCOMES, default: "none" },
    // _id of the row this came from in the old `checks` collection, so the
    // migration can re-run without duplicating. Absent on live checks: a stored
    // null would collide in the unique sparse index below.
    legacyId: { type: mongoose.Schema.Types.ObjectId },
    isDemo: { type: Boolean, default: false },
  }
);

const RAW_TEXT_FIELDS = ["query", "querySlug", "text", "message", "phone", "senderPhone", "senderHash"];

/**
 * Belt and braces on the privacy rule: if a caller ever passes raw query text
 * or a phone number, drop it rather than persisting it. A stored query string
 * would re-identify the person who sent it.
 */
checkSchema.pre("validate", function stripRawInput() {
  for (const field of RAW_TEXT_FIELDS) {
    if (this.get(field) !== undefined) this.set(field, undefined, { strict: false });
  }
});

checkSchema.index({ hourBucket: 1 });
checkSchema.index({ identifierHashes: 1 });
checkSchema.index({ matchedEntityIds: 1 });
checkSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

export default mongoose.model("Check", checkSchema, "check_events");
