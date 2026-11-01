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
import { runRiskCheck } from "../services/riskEngine.js";
import { slugify } from "../services/secData.js";
import { analyzeUrl } from "../services/urlAnalyzer.js";

const router = Router();

/** We never store raw phone numbers -- only a salted hash. */
function hashPhone(phone) {
  if (!phone) return "";
  const salt = process.env.PHONE_HASH_SALT;
  return crypto.createHash("sha256").update(`${salt}:${String(phone).replace(/\D/g, "")}`).digest("hex");
}

/* POST /api/check -- run a risk analysis on a company / token / link */
router.post("/check", async (req, res) => {
  const {
    query,
    channel = "whatsapp",
    additionalContext = "",
    spoofingDetection = null,
    injectedFlags = [],
    evidence = null,
  } = req.body || {};

  if (!query || !String(query).trim()) {
    return res.status(400).json({ ok: false, error: "A 'query' is required" });
  }

  try {
    const result = await runRiskCheck(query, {
      additionalContext,
      spoofingDetection,
      injectedFlags: Array.isArray(injectedFlags) ? injectedFlags : [],
      userEvidence: evidence,
    });

    // Log the check for analytics / trending -- never blocks the response.
    LegacyCheck.create({
      query: String(query).trim(),
      querySlug: result.slug,
      channel,
      result: {
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        riskVerdict: result.riskVerdict,
        status: result.status,
        category: result.category,
        redFlags: result.redFlags,
        analyzedBy: result.analyzedBy,
      },
    }).catch((err) => console.warn(`[api] could not log check: ${err.message}`));

    res.json({ ok: true, data: result });
  } catch (err) {
    console.error("[api] /check failed:", err);
    res.status(500).json({ ok: false, error: "Risk check failed" });
  }
});

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
