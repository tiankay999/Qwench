import crypto from "node:crypto";

import { ApiKey, hashApiKey } from "../models/index.js";

/**
 * Institutional authentication.
 *
 * Keys are verified with the same keyed HMAC used to mint them
 * (`hashApiKey`), not a bare SHA-256: a plain digest of an API key can be
 * brute-forced offline from a stolen database, a keyed one cannot without the
 * server key.
 */
export function apiKeyAuth(requiredScope) {
  return async function authenticate(req, res, next) {
    const raw = req.headers["x-api-key"];

    if (!raw || typeof raw !== "string") {
      return res.status(401).json({ error: "API key required", code: 401 });
    }

    let keyHash;
    try {
      keyHash = hashApiKey(raw);
    } catch (err) {
      // Missing HMAC_SECRET_KEY — a server fault, not the caller's.
      return next(err);
    }

    let apiKey;
    try {
      apiKey = await ApiKey.findOne({ keyHash, revokedAt: null }).lean();
    } catch (err) {
      return next(err);
    }

    // Compare in constant time so a timing difference cannot be used to probe
    // which prefixes exist.
    const valid = apiKey && timingSafeEqual(apiKey.keyHash, keyHash);
    if (!valid) {
      console.warn(`[auth] rejected API key with prefix "${String(raw).slice(0, 8)}"`);
      return res.status(401).json({ error: "Invalid or revoked API key", code: 401 });
    }

    if (requiredScope && !(apiKey.scopes || []).includes(requiredScope)) {
      return res.status(403).json({ error: "Insufficient scope for this endpoint", code: 403 });
    }

    req.org = apiKey.orgId;
    req.apiKeyId = String(apiKey._id);
    req.apiKeyScopes = apiKey.scopes || [];
    req.apiKeyRateLimit = apiKey.rateLimit || 100;
    next();
  };
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
