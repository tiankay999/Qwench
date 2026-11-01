import mongoose from "mongoose";

export const SIGNAL_REVIEW_STATUSES = ["pending", "reviewed", "dismissed"];

/**
 * Weekly check volume per entity or identifier, computed from Check rows.
 *
 * A spike is tier 4 (CHECK_SPIKE) -- a watch-list signal, never a verdict. A
 * lot of people asking about something means it is being promoted hard, which
 * is worth a look but is not itself evidence of fraud.
 */
const signalSchema = new mongoose.Schema(
  {
    // entity slug or identifier hash
    key: { type: String, required: true },
    weekStart: { type: Date, required: true },

    checksThisWeek: { type: Number, default: 0 },
    checksLastWeek: { type: Number, default: 0 },
    // distinct channels / senders, so one person cannot manufacture a spike
    distinctSources: { type: Number, default: 0 },

    anomalyFlag: { type: Boolean, default: false },
    reviewStatus: { type: String, enum: SIGNAL_REVIEW_STATUSES, default: "pending" },
  },
  { timestamps: true }
);

/** Week-on-week growth, or null when there is no prior week to compare. */
signalSchema.virtual("growthRate").get(function growthRate() {
  if (!this.checksLastWeek) return null;
  return Number((this.checksThisWeek / this.checksLastWeek).toFixed(2));
});

/**
 * A spike needs volume from several independent sources, not one enthusiastic
 * sender repeating a query.
 */
signalSchema.methods.isSpike = function isSpike({ minChecks = 10, minGrowth = 3, minSources = 5 } = {}) {
  if (this.checksThisWeek < minChecks) return false;
  if (this.distinctSources < minSources) return false;
  if (!this.checksLastWeek) return true;
  return this.checksThisWeek / this.checksLastWeek >= minGrowth;
};

signalSchema.index({ key: 1, weekStart: 1 }, { unique: true });
signalSchema.index({ anomalyFlag: 1 });
signalSchema.index({ weekStart: -1 });

export default mongoose.model("Signal", signalSchema);
