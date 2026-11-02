import mongoose from "mongoose";

export const SOURCE_TYPES = ["notice", "press_release", "sanctions_list", "register", "gazette"];

/**
 * Where a piece of information came from. Every Record links back to one of
 * these, so any claim Qwench makes can be traced to a published document.
 */
const sourceSchema = new mongoose.Schema(
  {
    // "SEC Ghana", "Bank of Ghana", "CSA Ghana", "ASIC", "OFAC"
    publisher: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: SOURCE_TYPES },
    // "Public Notice SEC/PN/002/07/2025"
    title: { type: String, required: true, trim: true },
    url: { type: String, trim: true },

    publishedOn: { type: Date, required: true },
    retrievedAt: { type: Date, default: Date.now },
    // Wayback Machine or local archive, so the claim survives the page going down
    archiveUrl: { type: String, trim: true },

    isOfficial: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

sourceSchema.index({ publisher: 1, title: 1 }, { unique: true });
sourceSchema.index({ publishedOn: -1 });

export default mongoose.model("Source", sourceSchema);
