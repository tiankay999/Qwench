import mongoose from "mongoose";

export const NOTICE_STATUSES = ["parsed", "needs_person", "handled", "not_relevant"];

/**
 * One regulator notice the collector has read, and a copy of the original, so a finding
 * can still be proven if the regulator's page changes.
 */
const collectedNoticeSchema = new mongoose.Schema(
  {
    collector: { type: String, required: true },
    externalId: { type: String, required: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    documentUrl: { type: String },
    publishedOn: { type: Date, required: true },
    modifiedOn: { type: Date },
    contentHash: { type: String },
    // The original file. Left out of ordinary reads, because it can be large.
    document: { type: Buffer, select: false },
    status: { type: String, enum: NOTICE_STATUSES, default: "parsed" },
    note: { type: String },
    entitiesFound: { type: Number, default: 0 },
    websitesForPerson: [{ type: String }],
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

collectedNoticeSchema.index({ collector: 1, externalId: 1 }, { unique: true });
collectedNoticeSchema.index({ status: 1 });

export default mongoose.model("CollectedNotice", collectedNoticeSchema);
