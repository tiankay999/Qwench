import mongoose from "mongoose";

export const ENTITY_KINDS = ["platform", "company", "token", "app", "merchant", "authority"];

/**
 * One row per real-world thing: a company, platform, token, app, merchant or
 * authority. An Entity carries no verdict of its own -- its standing comes
 * from the Records attached to it, each of which cites a Source.
 */
const entitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // lowercase, hyphenated, used in URLs
    slug: { type: String, required: true, unique: true, trim: true },
    kind: { type: String, required: true, enum: ENTITY_KINDS },
    // ISO 3166-1 alpha-2
    country: { type: String, default: "GH", uppercase: true, trim: true },
    aliases: [{ type: String, trim: true }],
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    // Names match exactly unless this is switched on for the entity
    allowFuzzy: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// slug already has a unique index from the field definition
entitySchema.index({ name: "text", aliases: "text" });
entitySchema.index({ kind: 1, isActive: 1 });

export default mongoose.model("Entity", entitySchema);
