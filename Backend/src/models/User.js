import mongoose from "mongoose";

export const USER_ROLES = ["analyst", "org_admin", "reviewer", "regulator"];

/**
 * Team login only. There is no public sign-up endpoint -- users are created by
 * an org_admin or by the system seed.
 */
const userSchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: USER_ROLES },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// A password must never reach this collection in the clear. bcrypt hashes are
// recognisable by their prefix; anything else is rejected rather than stored.
userSchema.pre("validate", function requireHashedPassword() {
  if (this.passwordHash && !/^\$2[aby]\$\d{2}\$/.test(this.passwordHash)) {
    throw (new Error("passwordHash must be a bcrypt hash — never store a plaintext password."));
  }
});

/** Never serialise the hash, even by accident. */
userSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

userSchema.index({ orgId: 1, role: 1 });

export default mongoose.model("User", userSchema);
