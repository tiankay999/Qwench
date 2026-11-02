// QWENCH API RULES — NEVER return any of these in any response:
// - Risk scores or risk verdicts
// - Risk colors
// - Recommendations or advice text
// - Community boost scores
// - Identity of who contributed data
// - Identity of who performed a check
// - Raw phone numbers or message text
// Sandbox, licensed, and authority results are LEGAL STATES, never warnings.
//
// A public reply may reveal only regulator and sanctions records, legal states and
// reviewed impersonation. Anything else must be identical to a no-record reply.

import { Router } from "express";

import { hashIdentifier, normalizeIdentifier } from "../lib/identifiers.js";
import { channelAuth, fairUse } from "../middleware/channelKey.js";
import { appealRules, publicCheckRules, publicReportRules } from "../middleware/validate.js";
import { Appeal, PublicReport, Record, Source } from "../models/index.js";
import { dataDate } from "../services/evidenceEngine.js";
import { checkMessage } from "../services/messageCheck.js";
import { logCheck } from "../utils/logCheck.js";

const router = Router();

const VOLUME_FLAG_AT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * POST /v1/public/check
 *
 * The main endpoint: WhatsApp bot, Telegram bot, and the web paste box.
 */
router.post("/check", publicCheckRules, channelAuth, fairUse, async (req, res, next) => {
  try {
    const { result, identifierHashes, matchedEntityIds, inputType } = await checkMessage({ ...req.body, channel: req.channel });

    // Never awaited, and never throws: a log write must not hold up the reply.
    logCheck({
      channel: req.channel,
      inputType,
      identifierHashes,
      matchedEntityIds,
      state: result.state,
      tier: result.tier,
      flags: result.reason_codes,
      outcome: "none",
      isDemo: result.is_demo,
    });

    return res.json({
      match: result.match,
      state: result.state,
      entity: result.entity,
      tier: result.tier,
      reason_codes: result.reason_codes,
      did_you_mean: result.did_you_mean || null,
      report: result.report,
      is_demo: result.is_demo,
      checked_at: result.checked_at,
    });
  } catch (err) {
    return next(err);
  }
});

/** Long digit runs in a name are probably someone's number. They aren't stored. */
const withoutNumbers = (text) => String(text).replace(/\+?\d[\d\s-]{6,}\d/g, "[number removed]").trim();

/**
 * POST /v1/public/reports
 *
 * A report only ever opens a review. The reply is the same whatever is already
 * known, with no count, so it can't be used to find out what Qwench holds.
 */
router.post("/reports", publicReportRules, channelAuth, fairUse, async (req, res, next) => {
  const { scheme_name: schemeName, identifiers = [], evidence_urls: evidenceUrls = [] } = req.body;

  try {
    const hashed = identifiers
      .map(({ type, value }) => ({ type, valueHash: hashIdentifier(type, normalizeIdentifier(type, value)) }))
      .filter((id) => id.valueHash);

    await PublicReport.create({
      schemeName: withoutNumbers(schemeName),
      identifiers: hashed,
      source: req.channel,
      evidenceRefs: evidenceUrls,
    });

    // Many reports from one channel get a person's attention. Nothing public changes.
    await Promise.all(
      hashed.map(async ({ valueHash }) => {
        const filter = { "identifiers.valueHash": valueHash, source: req.channel, createdAt: { $gte: new Date(Date.now() - DAY_MS) } };
        if ((await PublicReport.countDocuments(filter)) >= VOLUME_FLAG_AT) await PublicReport.updateMany(filter, { volumeFlag: true });
      })
    );

    return res.status(202).json({ received: true, message: "Thank you. A person will review this." });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /v1/public/appeals
 *
 * The reply never confirms or denies internal reports. It says the same thing
 * whether Qwench holds anything on the identifier or not, and a person answers
 * only about what Qwench shows publicly.
 */
router.post("/appeals", appealRules, async (req, res, next) => {
  const { type, value, contact, reason } = req.body;

  try {
    const normalized = normalizeIdentifier(type, value);
    if (!normalized) return next(Object.assign(new Error("Invalid input: value isn't valid for this type"), { status: 400, expose: true, code: "invalid_input" }));

    const appeal = await Appeal.create({ identifierHash: hashIdentifier(type, normalized), contact, reason });

    return res.status(202).json({
      received: true,
      reference: String(appeal._id),
      due_date: appeal.dueDate.toISOString().split("T")[0],
      message: "Thank you. A person will reply about what Qwench shows publicly.",
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /v1/public/about
 *
 * How current the data is, and how many reviewed records each publisher accounts
 * for. Partner data and demo data are not counted.
 */
router.get("/about", async (_req, res, next) => {
  try {
    const now = new Date();
    const counts = await Record.aggregate([
      { $match: { status: "active", isDemo: { $ne: true }, $or: [{ endsOn: null }, { endsOn: { $gt: now } }] } },
      { $group: { _id: "$sourceId", records: { $sum: 1 } } },
    ]);
    const sources = await Source.find({ _id: { $in: counts.map((c) => c._id) }, isDemo: { $ne: true } }).select("publisher").lean();
    const publisherOf = new Map(sources.map((s) => [String(s._id), s.publisher]));

    const byPublisher = new Map();
    for (const { _id, records } of counts) {
      const publisher = publisherOf.get(String(_id));
      if (publisher) byPublisher.set(publisher, (byPublisher.get(publisher) || 0) + records);
    }

    return res.json({
      data_date: await dataDate(),
      total_records: [...byPublisher.values()].reduce((a, b) => a + b, 0),
      records_by_source: [...byPublisher].map(([publisher, records]) => ({ publisher, records })).sort((a, b) => b.records - a.records),
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
