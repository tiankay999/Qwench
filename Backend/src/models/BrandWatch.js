import mongoose from "mongoose";

export const BRAND_WATCH_STATUSES = ["active", "paused"];

/**
 * A brand owner's standing request to be told when someone impersonates them.
 *
 * Scope limits this is built to respect: public content only, through official
 * platform APIs, acting on the brand owner's own authority. No scanning of
 * private chats.
 */
const brandWatchSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    brandName: { type: String, required: true, trim: true },
    officialDomains: [{ type: String, lowercase: true, trim: true }],
    // Hashed, like every other number in the system
    officialNumbers: [{ type: String }],
    keywords: [{ type: String, trim: true }],
    status: { type: String, enum: BRAND_WATCH_STATUSES, default: "active" },
  },
  { timestamps: true }
);

// Official numbers are hashes. A raw number here would put the brand's own
// contact details in a collection that is matched against scraped content.
brandWatchSchema.pre("validate", function requireHashedNumbers() {
  for (const n of this.officialNumbers || []) {
    if (n && !/^[a-f0-9]{64}$/i.test(n)) {
      throw (new Error("BrandWatch.officialNumbers must be HMAC-SHA256 hashes — use hashIdentifier()."));
    }
  }
});

brandWatchSchema.index({ brandName: "text", keywords: "text" });
brandWatchSchema.index({ orgId: 1, status: 1 });

export default mongoose.model("BrandWatch", brandWatchSchema);
