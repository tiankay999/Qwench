import mongoose from "mongoose";

export const RECORD_TYPES = ["warning", "licence", "sandbox", "registration", "foreign_alert", "sanction"];
export const RECORD_STATUSES = ["active", "expired", "superseded", "under_review"];

/**
 * An entity's standing under one source. An entity can hold several at once --
 * warned by SEC Ghana and separately by the Bank of Ghana, or licensed in one
 * jurisdiction and alerted against in another.
 */
const recordSchema = new mongoose.Schema(
  {
    entityId: { type: mongoose.Schema.Types.ObjectId, ref: "Entity", required: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Source", required: true },
    type: { type: String, required: true, enum: RECORD_TYPES },

    jurisdiction: { type: String, default: "GH", uppercase: true, trim: true },
    // "Fund Manager", "Broker-Dealer", "VASP (Sandbox)"
    licenseType: { type: String, trim: true },
    // Exact wording from the notice, so the claim can be checked against it
    quote: { type: String, trim: true },

    effectiveOn: { type: Date },
    // e.g. the end of a 12-month sandbox window
    endsOn: { type: Date },
    status: { type: String, enum: RECORD_STATUSES, default: "active" },

    capturedBy: { type: String, required: true, trim: true },
    reviewedBy: { type: String, trim: true },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

/**
 * Four-eyes principle, enforced rather than documented.
 *
 * A record only goes active once a second person has reviewed it, and that
 * person cannot be the one who entered it. Qwench's output can label a real
 * business as named in a fraud notice, so no single operator should be able to
 * put that live alone.
 */
recordSchema.pre("validate", function enforceFourEyes() {
  const captured = (this.capturedBy || "").trim().toLowerCase();
  const reviewed = (this.reviewedBy || "").trim().toLowerCase();

  if (reviewed && captured && reviewed === captured) {
    throw (
      new Error(
        `Four-eyes violation: "${this.capturedBy}" cannot review a record they captured. A second person must review it.`
      )
    );
  }

  if (this.status === "active" && !reviewed) {
    throw (
      new Error(
        "A record cannot be set active before review. Set status to 'under_review' until a second person signs it off."
      )
    );
  }

  if (reviewed && !this.reviewedAt) this.reviewedAt = new Date();
});

/** True once a different person has signed the record off. */
recordSchema.methods.isFourEyesClean = function isFourEyesClean() {
  const captured = (this.capturedBy || "").trim().toLowerCase();
  const reviewed = (this.reviewedBy || "").trim().toLowerCase();
  return Boolean(reviewed) && reviewed !== captured;
};

recordSchema.index({ entityId: 1, status: 1 });
recordSchema.index({ type: 1, status: 1 });
recordSchema.index({ sourceId: 1 });
recordSchema.index({ endsOn: 1 }, { sparse: true });

export default mongoose.model("Record", recordSchema);
