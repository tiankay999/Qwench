// QWENCH API RULES — NEVER return any of these in any response:
// - Risk scores or risk verdicts
// - Risk colors
// - Recommendations or advice text
// - Community boost scores
// - Identity of who contributed data
// - Identity of who performed a check
// - Raw phone numbers or message text
// Sandbox, licensed, and authority results are LEGAL STATES, never warnings.

import { Router } from "express";

import { apiKeyAuth } from "../middleware/apiKeyAuth.js";
import { sendError } from "../middleware/errorHandler.js";
import { institutionalLimiter } from "../middleware/rateLimiter.js";
import { checkRules, contributionRules, feedRules, merchantNumberRules } from "../middleware/validate.js";
import { buildIdentifier, hashIdentifier, normalizeIdentifier } from "../lib/identifiers.js";
import { Case, Contribution, Identifier, Merchant, Organization, Signal, recordAudit } from "../models/index.js";
import { sendFeed } from "../services/feed.js";
import { institutionCheck } from "../services/institutionCheck.js";

const router = Router();

/* ------------------------------------------------------------------ *
 * POST /v1/check — richer than the public shape, from the same engine
 * ------------------------------------------------------------------ */

router.post("/check", apiKeyAuth("check"), institutionalLimiter, checkRules, async (req, res, next) => {
  try {
    const org = await Organization.findById(req.org).select("confirmationCallLimitGhs warnsOnPartnerData").lean();
    return res.json(await institutionCheck({ ...req.body, org }));
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------------ *
 * GET /v1/feed — new, changed and removed records
 * ------------------------------------------------------------------ */

router.get("/feed", apiKeyAuth("feed"), institutionalLimiter, feedRules, async (req, res, next) => {
  try {
    const org = await Organization.findById(req.org).select("isDemo").lean();
    return await sendFeed(req, res, org);
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------------ *
 * POST /v1/contributions — member organisations share scheme details
 * ------------------------------------------------------------------ */

router.post("/contributions", apiKeyAuth("contributions"), institutionalLimiter, contributionRules, async (req, res, next) => {
  const { schemeName, identifiers, terms, region, lossBand, evidenceRefs } = req.body;

  try {
    // Hash every identifier before it is stored. The raw value is used only to
    // compute the digest and is never written anywhere.
    const hashed = (identifiers || [])
      .filter((id) => id?.type && id?.value)
      .map((id) => {
        const normalized = normalizeIdentifier(id.type, id.value);
        return { type: id.type, valueHash: hashIdentifier(id.type, normalized) };
      })
      .filter((id) => id.valueHash);

    const contribution = await Contribution.create({
      orgId: req.org,
      schemeName,
      identifiers: hashed,
      terms,
      region,
      lossBand,
      evidenceRefs: Array.isArray(evidenceRefs) ? evidenceRefs : [],
      reviewStatus: "pending",
    });

    await recordAudit({
      actor: String(req.org),
      action: "contribution.create",
      target: `Contribution:${contribution._id}`,
      after: { schemeName, region },
    });

    return res.status(201).json({ id: contribution._id, status: "pending" });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * GET /v1/signals — rising names, reviewed only
 * ------------------------------------------------------------------ */

router.get("/signals", apiKeyAuth("signals"), institutionalLimiter, async (req, res, next) => {
  try {
    // Only reviewed spikes are published. An unreviewed spike is just a lot of
    // people asking a question, which is not evidence of anything.
    const signals = await Signal.find({ anomalyFlag: true, reviewStatus: "reviewed" })
      .sort({ checksThisWeek: -1 })
      .limit(50)
      .lean();

    return res.json({
      count: signals.length,
      signals: signals.map((s) => ({
        key: s.key,
        checks_this_week: s.checksThisWeek,
        checks_last_week: s.checksLastWeek,
        distinct_sources: s.distinctSources,
        week_start: s.weekStart,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * GET /v1/cases/:id — case status
 * ------------------------------------------------------------------ */

router.get("/cases/:id", apiKeyAuth("cases"), institutionalLimiter, async (req, res, next) => {
  try {
    const caseDoc = await Case.findOne({ caseNumber: req.params.id }).lean();
    if (!caseDoc) return sendError(res, 404, "case_not_found", "Case not found");

    // ownerId and the hashed identifiers stay internal: who is investigating is
    // not an institution's business.
    return res.json({
      case_number: caseDoc.caseNumber,
      type: caseDoc.type,
      status: caseDoc.status,
      tier: caseDoc.tier,
      referrals: (caseDoc.referrals || []).map((r) => ({ to: r.to, date: r.date, reference: r.reference })),
      outcome: caseDoc.outcome || null,
      created_at: caseDoc.createdAt,
      updated_at: caseDoc.updatedAt,
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * POST /v1/merchants/verify-number
 * ------------------------------------------------------------------ */

router.post("/merchants/verify-number", apiKeyAuth("merchants"), institutionalLimiter, merchantNumberRules, async (req, res, next) => {
  const { number, type } = req.body;

  try {
    const built = buildIdentifier(type, number);
    const identifier = await Identifier.findOne({ valueHash: built.valueHash, status: "active" }).lean();

    if (!identifier) {
      // No claim. Deliberately not phrased as a negative: most legitimate
      // traders never register, so "not registered" must not read as "suspect".
      return res.json({ registered: false, message: "Number not found in registry" });
    }

    const merchant = await Merchant.findOne({ officialIdentifiers: identifier._id, status: "verified" })
      .select("legalName verifiedAt")
      .lean();

    if (merchant) {
      return res.json({
        registered: true,
        business: merchant.legalName,
        verified_at: merchant.verifiedAt,
        // Never "safe" — registration proves control of a number, nothing more.
        message: `Registered by ${merchant.legalName}`,
      });
    }

    return res.json({ registered: false, message: "Number not found in registry" });
  } catch (err) {
    next(err);
  }
});

export default router;
