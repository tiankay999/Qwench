// QWENCH API RULES — NEVER return any of these in any response:
// - Risk scores or risk verdicts
// - Identity of who contributed data
// - Identity of who performed a check
// - Raw phone numbers or message text
//
// The console's routes use a login session, so no API key ever sits in the browser.

import bcrypt from "bcrypt";
import { Router } from "express";

import { sendError } from "../middleware/errorHandler.js";
import { consoleLimiter, endSession, loginLimiter, requireQwenchReviewer, requireRole, requireSession, startSession } from "../middleware/session.js";
import { apiKeyRules, checkRules, feedRules, loginRules, reviewRules } from "../middleware/validate.js";
import { ApiKey, Organization, User, generateApiKey, recordAudit } from "../models/index.js";
import { sendFeed } from "../services/feed.js";
import { consoleLookup, institutionCheck } from "../services/institutionCheck.js";
import { decide, listQueue } from "../services/reviewQueue.js";

const router = Router();

// Compared against when the email is unknown, so both cases take the same time.
const NO_SUCH_USER = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8Vrg5q8YzQ5Kq3b1dZ3h5l9Zq5cJ6e";

const userView = (user, org) => ({ email: user.email, role: user.role, organization: org.name, is_demo: Boolean(org.isDemo) });

/* --- Session --------------------------------------------------------- */

router.post("/login", loginLimiter, loginRules, async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email.trim().toLowerCase() });
    const matches = await bcrypt.compare(req.body.password, user?.passwordHash || NO_SUCH_USER);
    const org = user && matches && user.isActive ? await Organization.findById(user.orgId).lean() : null;

    if (!org || org.status === "suspended") {
      return sendError(res, 401, "invalid_credentials", "That email or password isn't right");
    }

    startSession(res, user);
    return res.json({ user: userView(user, org) });
  } catch (err) {
    return next(err);
  }
});

router.post("/logout", (_req, res) => {
  endSession(res);
  res.json({ logged_out: true });
});

const signedIn = [requireSession, consoleLimiter];

router.get("/me", signedIn, (req, res) => res.json({ user: userView(req.user, req.organization) }));

/* --- Lookup, payment check and feed ----------------------------------- */

router.post("/lookup", signedIn, checkRules, async (req, res, next) => {
  try {
    return res.json(await consoleLookup({ ...req.body, org: req.organization }));
  } catch (err) {
    return next(err);
  }
});

router.post("/payment-check", signedIn, checkRules, async (req, res, next) => {
  try {
    return res.json(await institutionCheck({ ...req.body, org: req.organization }));
  } catch (err) {
    return next(err);
  }
});

router.get("/feed", signedIn, feedRules, async (req, res, next) => {
  try {
    return await sendFeed(req, res, req.organization);
  } catch (err) {
    return next(err);
  }
});

/* --- API keys: an organisation's own, for its admin -------------------- */

const keyView = (key) => ({
  id: String(key._id),
  prefix: key.prefix,
  scopes: key.scopes,
  created_at: key.createdAt,
  last_used_at: key.lastUsedAt || null,
  revoked_at: key.revokedAt || null,
});

const admin = [...signedIn, requireRole("org_admin")];

router.get("/api-keys", admin, async (req, res, next) => {
  try {
    const keys = await ApiKey.find({ orgId: req.user.orgId }).sort({ createdAt: -1 }).lean();
    return res.json({ keys: keys.map(keyView) });
  } catch (err) {
    return next(err);
  }
});

router.post("/api-keys", admin, apiKeyRules, async (req, res, next) => {
  try {
    const { rawKey, prefix, keyHash } = generateApiKey({ live: !req.organization.isDemo });
    const key = await ApiKey.create({ orgId: req.user.orgId, keyHash, prefix, scopes: req.body.scopes });
    await recordAudit({ actor: req.user.email, action: "api_key.create", target: `ApiKey:${key._id}`, after: { scopes: key.scopes } });

    // The only time the full key is ever shown.
    return res.status(201).json({ ...keyView(key), key: rawKey });
  } catch (err) {
    return next(err);
  }
});

router.delete("/api-keys/:id", admin, async (req, res, next) => {
  try {
    const key = /^[a-f0-9]{24}$/i.test(req.params.id) ? await ApiKey.findOne({ _id: req.params.id, orgId: req.user.orgId }) : null;
    if (!key) return sendError(res, 404, "not_found", "That key doesn't exist");

    if (!key.revokedAt) {
      key.revokedAt = new Date();
      await key.save();
      await recordAudit({ actor: req.user.email, action: "api_key.revoke", target: `ApiKey:${key._id}` });
    }
    return res.json(keyView(key));
  } catch (err) {
    return next(err);
  }
});

/* --- Review queue: Qwench's reviewers only ----------------------------- */

const reviewers = [...signedIn, requireQwenchReviewer];

router.get("/review-queue", reviewers, async (req, res, next) => {
  try {
    const items = await listQueue(req.user, req.organization);
    return res.json({ count: items.length, items });
  } catch (err) {
    return next(err);
  }
});

router.post("/review-queue/:id", reviewers, reviewRules, async (req, res, next) => {
  try {
    const outcome = await decide({ kindName: req.body.kind, id: req.params.id, decision: req.body.decision, user: req.user, org: req.organization });
    if (outcome.error) return sendError(res, outcome.error.status, outcome.error.code, outcome.error.message);
    return res.json({ id: req.params.id, kind: req.body.kind, status: outcome.status });
  } catch (err) {
    return next(err);
  }
});

export default router;
