import mongoose from "mongoose";

/**
 * The relative times on a page when it was last checked, as a hash.
 *
 * "2 minutes ago" should change. If a page still says the same hours later, those
 * comments aren't real. Held against a keyed hash of the address, so this can't become
 * a list of what people checked, and it holds no page text.
 */
const pageSeenSchema = new mongoose.Schema({
  pageHash: { type: String, required: true, unique: true },
  timeSignature: { type: String, required: true },
  firstSeen: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

pageSeenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("PageSeen", pageSeenSchema);
