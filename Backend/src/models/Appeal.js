import mongoose from "mongoose";

import { encryptContact } from "../lib/identifiers.js";

export const APPEAL_STATUSES = ["open", "under_review", "upheld", "overturned"];
export const CLOSED_STATUSES = new Set(["upheld", "overturned"]);

/**
 * A challenge to a flag. Anyone named by Qwench must be able to contest it.
 *
 * The contact is encrypted rather than hashed, because an appeal has to be
 * answerable, and it is deleted once the appeal closes.
 */
const appealSchema = new mongoose.Schema(
  {
    identifierHash: { type: String, required: true },
    // AES-256-GCM, cleared on closure. Required only while the appeal is open —
    // see the conditional required() below.
    contact: { type: String, default: "" },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: APPEAL_STATUSES, default: "open" },
    dueDate: { type: Date },
    resolution: { type: String, trim: true },
    contactErasedAt: { type: Date },
  },
  { timestamps: true }
);

const ENCRYPTED_RE = /^[A-Za-z0-9+/=_-]+\.[A-Za-z0-9+/=_-]+\.[A-Za-z0-9+/=_-]+$/;

appealSchema.pre("validate", function handleContact() {
  // Accept a plaintext contact and encrypt it, so a caller cannot store one by
  // forgetting to. An already-encrypted value passes through untouched.
  if (this.contact && !ENCRYPTED_RE.test(this.contact)) {
    // Let an encryption failure reject the write: storing the contact in the
    // clear because the key was missing would be worse than losing the appeal.
    this.contact = encryptContact(this.contact);
  }

  // Once closed, the contact is no longer needed and must not linger.
  if (CLOSED_STATUSES.has(this.status) && this.contact) {
    this.contact = "";
    this.contactErasedAt = new Date();
  }
});

// `contact` is required, but an erased one is legitimately empty.
appealSchema.path("contact").required(function contactRequiredUnlessClosed() {
  return !CLOSED_STATUSES.has(this.status);
});

/** Default 14-day response window when none is given. */
appealSchema.pre("save", function setDueDate() {
  if (this.isNew && !this.dueDate) {
    this.dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  }
});

appealSchema.index({ status: 1 });
appealSchema.index({ identifierHash: 1 });
appealSchema.index({ dueDate: 1 }, { sparse: true });

export default mongoose.model("Appeal", appealSchema);
