import rateLimit, { ipKeyGenerator } from "express-rate-limit";

import { sendError } from "./errorHandler.js";

const tooMany = (_req, res) => sendError(res, 429, "rate_limited", "Too many requests. Try again in 60 seconds.");

/**
 * Public endpoints: 30 requests per minute per IP.
 */
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany,
});

/**
 * Institutional endpoints: the per-minute allowance stored on the API key.
 *
 * Keyed on the key's id rather than the IP, so one organisation behind a NAT
 * cannot exhaust another's allowance, and a single org cannot multiply its
 * quota by calling from several addresses.
 */
export const institutionalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => req.apiKeyRateLimit || 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.apiKeyId ? `key:${req.apiKeyId}` : `ip:${ipKeyGenerator(req.ip)}`),
  handler: tooMany,
});
