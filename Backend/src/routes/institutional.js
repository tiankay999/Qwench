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
import { Case, Contribution, Entity, Identifier, Merchant, Organization, Relation, Signal, recordAudit } from "../models/index.js";
import { evaluate } from "../services/evidenceEngine.js";
import { logCheck } from "../utils/logCheck.js";

const router = Router();

/* ------------------------------------------------------------------ *
 * POST /v1/check — richer than the public shape, same verdict logic
 * ------------------------------------------------------------------ */

router.post("/check", apiKeyAuth("check"), institutionalLimiter, checkRules, async (req, res, next) => {
  const { recipient, type, amount_ghs: amountGhs, new_payee: newPayee = false } = req.body;

  try {
    const org = await Organization.findById(req.org).select("confirmationCallLimitGhs warnsOnPartnerData").lean();
    const result = await evaluate({ recipient, type, amount_ghs: amountGhs, new_payee: newPayee, audience: "institution", org });

    // Never awaited, and never throws: a log write must not hold up the reply.
    logCheck({
      channel: "api",
      inputType: inputTypeFor(type),
      identifierHashes: [result.value_hash],
      matchedEntityIds: result.entity_id ? [result.entity_id] : [],
      state: result.state,
      tier: result.tier,
      flags: result.reason_codes,
      outcome: result.suggested_action,
      isDemo: result.is_demo,
    });

    const shared = {
      match: result.match,
      entity: result.entity,
      state: result.state,
      tier: result.tier,
      reason_codes: result.reason_codes,
      sources: result.sources,
      foreign_context: result.foreign_context,
      allowed_use: result.allowed_use,
      suggested_action: result.suggested_action,
      report: result.report,
      is_demo: result.is_demo,
      checked_at: result.checked_at,
    };

    if (!result.match) {
      return res.json({ ...shared, ...(result.did_you_mean ? { did_you_mean: result.did_you_mean } : {}) });
    }

    const [entity, relations, signal] = await Promise.all([
      result.entity_id ? Entity.findById(result.entity_id).select("kind").lean() : null,
      result.entity_id ? Relation.find({ fromEntity: result.entity_id, status: "active" }).populate("toEntity", "name slug kind").lean() : [],
      result.entity_slug
        ? Signal.findOne({ key: { $in: [String(result.entity_id), result.entity_slug] }, anomalyFlag: true, reviewStatus: "reviewed" })
            .sort({ weekStart: -1 })
            .lean()
        : null,
    ]);

    return res.json({
      ...shared,
      entity_slug: result.entity_slug,
      entity_kind: entity?.kind || null,
      relations: relations.map((rel) => ({
        type: rel.type,
        to_entity: rel.toEntity?.name || null,
        to_entity_slug: rel.toEntity?.slug || null,
      })),
      merchant_claim: result.merchant_claim || { registered: false },
      signal: signal
        ? {
            checks_this_week: signal.checksThisWeek,
            checks_last_week: signal.checksLastWeek,
            distinct_sources: signal.distinctSources,
            week_start: signal.weekStart,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ *
 * GET /v1/feed?since= — new and changed records
 * ------------------------------------------------------------------ */

router.get("/feed", apiKeyAuth("feed"), institutionalLimiter, feedRules, async (req, res, next) => {
  const { since, format } = req.query;
  const limit = Math.min(Number(req.query.limit) || 1000, 1000);

  try {
    const records = await Record.find({ updatedAt: { $gt: new Date(since) }, status: "active" })
      .populate("entityId", "name slug kind")
      .populate("sourceId")
      .sort({ updatedAt: 1 })
      .limit(limit)
      .lean();

    const results = records
      .filter((r) => r.entityId && r.sourceId)
      .map((r) => ({
        entity: r.entityId.name,
        entity_slug: r.entityId.slug,
        record_type: r.type,
        jurisdiction: r.jurisdiction,
        source: {
          publisher: r.sourceId.publisher,
          title: r.sourceId.title,
          date: r.sourceId.publishedOn,
          url: r.sourceId.url || null,
        },
        status: r.status,
        effective_on: r.effectiveOn || null,
        updated_at: r.updatedAt,
      }));

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=qwench_feed.csv");
      return res.send(toCsv(results));
    }

    return res.json({ count: results.length, records: results });
  } catch (err) {
    next(err);
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

/* ------------------------------------------------------------------ */

function inputTypeFor(type) {
  switch (type) {
    case "momo_number":
    case "bank_account":
      return "number";
    case "domain":
      return "domain";
    case "url":
    case "telegram_link":
      return "url";
    case "wallet":
      return "wallet";
    default:
      return "name";
  }
}

function toCsv(rows) {
  const columns = [
    "entity",
    "entity_slug",
    "record_type",
    "jurisdiction",
    "source_publisher",
    "source_title",
    "source_date",
    "source_url",
    "status",
    "effective_on",
    "updated_at",
  ];

  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = v instanceof Date ? v.toISOString() : String(v);
    // Guard against a leading =, +, - or @ being run as a formula by a
    // spreadsheet when an analyst opens the export.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const lines = [columns.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.entity,
        r.entity_slug,
        r.record_type,
        r.jurisdiction,
        r.source.publisher,
        r.source.title,
        r.source.date,
        r.source.url,
        r.status,
        r.effective_on,
        r.updated_at,
      ]
        .map(escape)
        .join(",")
    );
  }
  return lines.join("\n");
}

export default router;
