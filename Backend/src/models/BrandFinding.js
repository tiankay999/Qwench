import mongoose from "mongoose";

export const FINDING_REVIEW_STATUSES = ["pending", "confirmed", "false_positive"];
export const TAKEDOWN_STATUSES = ["not_requested", "requested", "completed", "failed"];

/**
 * One suspected impersonation of a watched brand.
 *
 * Flow: finding -> review -> alert -> takedown pack -> status tracked. A
 * finding is never actioned straight from detection; a person confirms it
 * first, because a takedown request against a legitimate account is not
 * something that can be undone quietly.
 */
const brandFindingSchema = new mongoose.Schema(
  {
    watchId: { type: mongoose.Schema.Types.ObjectId, ref: "BrandWatch", required: true },
    // "tiktok", "telegram", "web", "whatsapp"
    platform: { type: String, trim: true },
    url: { type: String, trim: true },
    claimedName: { type: String, trim: true },

    identifiersFound: {
      type: [
        new mongoose.Schema(
          {
            type: { type: String, trim: true },
            value: { type: String, trim: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    firstSeen: { type: Date, default: Date.now },
    evidenceRefs: [{ type: String }],
    reviewStatus: { type: String, enum: FINDING_REVIEW_STATUSES, default: "pending" },
    takedownStatus: { type: String, enum: TAKEDOWN_STATUSES, default: "not_requested" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// A takedown may only be requested for a finding a human has confirmed.
brandFindingSchema.pre("validate", function requireConfirmationBeforeTakedown() {
  if (this.takedownStatus !== "not_requested" && this.reviewStatus !== "confirmed") {
    throw (
      new Error("A takedown can only be requested after a reviewer confirms the finding (reviewStatus: 'confirmed').")
    );
  }
});

brandFindingSchema.index({ watchId: 1, reviewStatus: 1 });
brandFindingSchema.index({ takedownStatus: 1 });
brandFindingSchema.index({ firstSeen: -1 });

export default mongoose.model("BrandFinding", brandFindingSchema);
