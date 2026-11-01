import crypto from "node:crypto";
import mongoose from "mongoose";

export const API_SCOPES = ["check", "feed", "contributions", "signals"];

/**
 * Institutional API access. Only the hash of a key is stored -- the raw key is
 * shown once at creation and cannot be recovered afterwards.
 */
const apiKeySchema = new mongoose.Schema(
  {
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    keyHash: { type: String, required: true },
    // First characters, for identifying a key in a list without revealing it
    prefix: { type: String, required: true, trim: true },
    scopes: [{ type: String, enum: API_SCOPES }],
    rateLimit: { type: Number, default: 100 },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

apiKeySchema.virtual("isActive").get(function isActive() {
  return !this.revokedAt;
});

apiKeySchema.index({ keyHash: 1 });
apiKeySchema.index({ prefix: 1 });
apiKeySchema.index({ orgId: 1, revokedAt: 1 });

const KEY_BYTES = 24;

/** HMAC rather than a bare SHA, so a stolen database cannot be brute-forced offline. */
export function hashApiKey(rawKey) {
  const secret = process.env.HMAC_SECRET_KEY;
  if (!secret || !secret.trim()) throw new Error("HMAC_SECRET_KEY is not set — cannot hash an API key");
  return crypto.createHmac("sha256", secret).update(String(rawKey)).digest("hex");
}

/**
 * Mint a key. The raw value is returned to the caller exactly once; only the
 * hash and prefix are persisted.
 */
export function generateApiKey({ live = true } = {}) {
  const prefix = live ? "qw_live_" : "qw_test_";
  const rawKey = prefix + crypto.randomBytes(KEY_BYTES).toString("base64url");
  return { rawKey, prefix, keyHash: hashApiKey(rawKey) };
}

export default mongoose.model("ApiKey", apiKeySchema);
