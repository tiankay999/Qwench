import crypto from "node:crypto";
import { Router } from "express";

import Check from "../models/Check.js";
import Investment from "../models/Investment.js";
import Report from "../models/Report.js";
import { getTrendingCoins } from "../services/coingecko.js";
import { runRiskCheck } from "../services/riskEngine.js";
import { slugify } from "../services/secData.js";

const router = Router();

/** We never store raw phone numbers -- only a salted hash. */
function hashPhone(phone) {
  if (!phone) return "";
  const salt = process.env.PHONE_HASH_SALT || "qwench-dev-salt";
  return crypto.createHash("sha256").update(`${salt}:${String(phone).replace(/\D/g, "")}`).digest("hex");
}

/* POST /api/check -- run a risk analysis on a company / token / link */
router.post("/check", async (req, res) => {
  const { query, channel = "whatsapp" } = req.body || {};

  if (!query || !String(query).trim()) {
    return res.status(400).json({ ok: false, error: "A 'query' is required" });
  }

  try {
    const result = await runRiskCheck(query);

    // Log the check for analytics / trending -- never blocks the response.
    Check.create({
      query: String(query).trim(),
      querySlug: result.slug,
      channel,
      result: {
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        status: result.status,
        category: result.category,
        redFlags: result.redFlags,
      },
    }).catch((err) => console.warn(`[api] could not log check: ${err.message}`));

    res.json({ ok: true, data: result });
  } catch (err) {
    console.error("[api] /check failed:", err);
    res.status(500).json({ ok: false, error: "Risk check failed" });
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
    const [checks, reports, licensed, blacklisted] = await Promise.all([
      Check.countDocuments(),
      Report.countDocuments(),
      Investment.countDocuments({ status: "licensed" }),
      Investment.countDocuments({ status: "blacklisted" }),
    ]);
    res.json({
      ok: true,
      data: {
        totalChecks: checks,
        totalReports: reports,
        licensedEntities: licensed,
        blacklistedEntities: blacklisted,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Could not load stats" });
  }
});

export default router;
