import crypto from "node:crypto";
import { Router } from "express";

import AiAnalysis from "../models/AiAnalysis.js";
import LegacyCheck from "../models/LegacyCheck.js";
import Investment from "../models/Investment.js";
import Report from "../models/Report.js";
import { aiStatus } from "../services/aiAnalyzer.js";
import { getTrendingCoins } from "../services/coingecko.js";
import { analyzeImage } from "../services/imageAnalyzer.js";
import { verifyName } from "../services/nameVerifier.js";
import { evaluate } from "../services/evidenceEngine.js";
import { slugify } from "../services/secData.js";
import { logCheck } from "../utils/logCheck.js";
import { analyzeUrl } from "../services/urlAnalyzer.js";

const router = Router();

/** We never store raw phone numbers -- only a salted hash. */
function hashPhone(phone) {
  if (!phone) return "";
  const salt = process.env.PHONE_HASH_SALT;
  return crypto.createHash("sha256").update(`${salt}:${String(phone).replace(/\D/g, "")}`).digest("hex");
}

/* POST /api/check -- run a risk analysis on a company / token / link */
/**
 * POST /api/check — the bot's endpoint, now served by the evidence engine.
 *
 * Returns a legal state, an evidence tier, reason codes and sources. There is
 * no score, verdict, colour or recommendation here any more: those came from
 * a model's judgement, and judgement is not what this system is for.
 */
router.post("/check", async (req, res) => {
  const {
    query,
    channel = "whatsapp",
    amount_ghs: amountGhs,
    new_payee: newPayee = false,
    // The bot sets this once it has already asked which name was meant.
    skipConfirmation = false,
  } = req.body || {};

  if (!query || !String(query).trim()) {
    return res.status(400).json({ ok: false, error: "A 'query' is required" });
  }

  try {
    const type = inferType(query);
    const result = await evaluate({
      recipient: query,
      type,
      amount_ghs: amountGhs,
      new_payee: newPayee,
      skip_confirmation: skipConfirmation,
      audience: "public",
    });

    // Never awaited, and never throws: a log write must not hold up the reply.
    logCheck({
      channel: ["whatsapp", "telegram", "web", "api"].includes(channel) ? channel : "whatsapp",
      inputType: type === "momo_number" ? "number" : type === "url" ? "url" : type,
      identifierHashes: [result.value_hash],
      matchedEntityIds: result.entity_id ? [result.entity_id] : [],
      state: result.state,
      tier: result.tier,
      flags: result.reason_codes,
      outcome: result.suggested_action,
      isDemo: result.is_demo,
    });

    // The hash stays on this side of the API.
    const { value_hash: _hash, entity_id: _id, ...reply } = result;
    res.json({ ok: true, data: reply });
  } catch (err) {
    console.error("[api] /check failed:", err);
    res.status(500).json({ ok: false, error: "Check failed" });
  }
});

/** Work out what the user sent us, so the bot does not have to say. */
function inferType(query) {
  const q = String(query).trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(q)) return "wallet";
  if (/^https?:\/\//i.test(q)) return "url";

  // Any number of labels before the TLD, so multi-label domains such as
  // sec.gov.gh and gse.com.gh are recognised rather than read as a name.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(q) && !/\s/.test(q)) return "url";

  if (/^\+?[\d\s\-()]{9,15}$/.test(q)) return "momo_number";
  return "name";
}

/* POST /api/verify-name -- anti-spoofing check, runs BEFORE /api/check */
router.post("/verify-name", async (req, res) => {
  const { query } = req.body || {};

  if (!query || !String(query).trim()) {
    return res.status(400).json({ ok: false, error: "A 'query' is required" });
  }

  try {
    const verification = await verifyName(query);
    res.json({ ok: true, data: verification });
  } catch (err) {
    console.error("[api] /verify-name failed:", err);
    // Never block a check because verification broke -- fail open to "no match".
    res.json({
      ok: true,
      degraded: true,
      data: { query, decision: "no_match", match: null, needsConfirmation: false, autoFlagged: false, injectedFlags: [] },
    });
  }
});

/* POST /api/evidence/image -- analyze a screenshot the user forwarded */
router.post("/evidence/image", async (req, res) => {
  const { base64, mimeType = "image/jpeg", entityName = "" } = req.body || {};

  if (!base64) return res.status(400).json({ ok: false, error: "A 'base64' image is required" });

  try {
    const analysis = await analyzeImage(base64, mimeType, entityName);
    res.json({ ok: !analysis.error, data: analysis });
  } catch (err) {
    console.error("[api] /evidence/image failed:", err);
    res.status(500).json({ ok: false, error: "Could not analyze that image" });
  }
});

/* POST /api/evidence/url -- fetch and analyze a link the user sent */
router.post("/evidence/url", async (req, res) => {
  const { url, entityName = "" } = req.body || {};

  if (!url || !String(url).trim()) return res.status(400).json({ ok: false, error: "A 'url' is required" });

  try {
    const analysis = await analyzeUrl(String(url).trim(), entityName);
    res.json({ ok: !analysis.error, data: analysis });
  } catch (err) {
    console.error("[api] /evidence/url failed:", err);
    res.status(500).json({ ok: false, error: "Could not analyze that link" });
  }
});

/* POST /api/report -- save a community scam report */
router.post("/report", async (req, res) => {
  const { schemeName, schemeType = "other", source = "other", description = "", reporterPhone = "" } = req.body || {};

  if (!schemeName || !String(schemeName).trim()) {
    return res.status(400).json({ ok: false, error: "A 'schemeName' is required" });
  }

  try {
    const report = await Report.create({
      schemeName: String(schemeName).trim(),
      schemeSlug: slugify(schemeName),
      schemeType,
      source,
      description,
      reporterPhone: hashPhone(reporterPhone),
    });

    const total = await Report.countDocuments({ schemeSlug: report.schemeSlug });
    console.log(`[api] report saved: "${report.schemeName}" via ${source} (${total} total for this scheme)`);

    res.status(201).json({
      ok: true,
      data: { id: report._id, schemeName: report.schemeName, status: report.status, totalReportsForScheme: total },
    });
  } catch (err) {
    console.error("[api] /report failed:", err);
    res.status(500).json({ ok: false, error: "Could not save report" });
  }
});

/* GET /api/reports -- recent community reports */
router.get("/reports", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  try {
    const reports = await Report.find({}, { reporterPhone: 0 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    console.log(`[api] returning ${reports.length} recent reports`);
    res.json({ ok: true, count: reports.length, data: reports });
  } catch (err) {
    console.error("[api] /reports failed:", err);
    res.status(500).json({ ok: false, error: "Could not load reports" });
  }
});

/* GET /api/trending -- most-reported schemes */
router.get("/trending", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);

  try {
    const trending = await Report.aggregate([
      {
        $group: {
          _id: "$schemeSlug",
          schemeName: { $first: "$schemeName" },
          schemeType: { $first: "$schemeType" },
          reportCount: { $sum: 1 },
          lastReported: { $max: "$createdAt" },
          sources: { $addToSet: "$source" },
        },
      },
      { $sort: { reportCount: -1, lastReported: -1 } },
      { $limit: limit },
      { $project: { _id: 0, slug: "$_id", schemeName: 1, schemeType: 1, reportCount: 1, lastReported: 1, sources: 1 } },
    ]);

    console.log(`[api] returning ${trending.length} trending schemes`);
    res.json({ ok: true, count: trending.length, data: trending });
  } catch (err) {
    console.error("[api] /trending failed:", err);
    res.status(500).json({ ok: false, error: "Could not load trending schemes" });
  }
});

/* GET /api/register -- the SEC Ghana lists as loaded into MongoDB.
   ?status=licensed|blacklisted|revoked   ?category=crypto|forex|...   ?q=search */
router.get("/register", async (req, res) => {
  const { status, category, q } = req.query;
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (q) filter.$or = [{ name: new RegExp(String(q), "i") }, { aliases: slugify(q) }];

  try {
    const entities = await Investment.find(filter, { redFlags: 0 })
      .sort({ status: 1, name: 1 })
      .limit(limit)
      .lean();

    console.log(`[api] returning ${entities.length} register entries`);
    res.json({ ok: true, count: entities.length, data: entities });
  } catch (err) {
    console.error("[api] /register failed:", err);
    res.status(500).json({ ok: false, error: "Could not load the register" });
  }
});

/* GET /api/crypto/trending -- CoinGecko's currently trending coins */
router.get("/crypto/trending", async (_req, res) => {
  try {
    const coins = await getTrendingCoins();
    res.json({ ok: true, count: coins.length, data: coins });
  } catch (err) {
    console.error("[api] /crypto/trending failed:", err);
    res.status(500).json({ ok: false, error: "Could not load trending coins" });
  }
});

/* GET /api/stats -- small counter set, handy for the web app dashboard */
router.get("/stats", async (_req, res) => {
  try {
    const [checks, reports, licensed, sandbox, blacklisted, aiCalls, aiFailures] = await Promise.all([
      LegacyCheck.countDocuments(),
      Report.countDocuments(),
      Investment.countDocuments({ status: "licensed" }),
      Investment.countDocuments({ status: "sandbox" }),
      Investment.countDocuments({ status: "blacklisted" }),
      AiAnalysis.countDocuments(),
      AiAnalysis.countDocuments({ ok: false }),
    ]);
    res.json({
      ok: true,
      data: {
        totalChecks: checks,
        totalReports: reports,
        licensedEntities: licensed,
        sandboxEntities: sandbox,
        blacklistedEntities: blacklisted,
        ai: { ...aiStatus(), calls: aiCalls, failures: aiFailures },
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Could not load stats" });
  }
});

export default router;
