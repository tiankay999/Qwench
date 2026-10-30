import "dotenv/config";

import crypto from "node:crypto";
import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import Investment from "../models/Investment.js";
import Report from "../models/Report.js";
import { secData, slugify } from "../services/secData.js";

function hashPhone(phone) {
  const salt = process.env.PHONE_HASH_SALT || "qwench-dev-salt";
  return crypto.createHash("sha256").update(`${salt}:${phone}`).digest("hex");
}

// A few seeded community reports so /api/trending has something to show on day one.
const SEED_REPORTS = [
  { schemeName: "Menzgold Ghana Ltd", schemeType: "ponzi", source: "friend", description: "My uncle lost GHS 20,000 and was never paid back.", status: "confirmed" },
  { schemeName: "Menzgold Ghana Ltd", schemeType: "ponzi", source: "whatsapp", description: "Agents are still recruiting in WhatsApp groups.", status: "confirmed" },
  { schemeName: "Menzgold Ghana Ltd", schemeType: "ponzi", source: "social-media", description: "Facebook ads promising gold dividends again.", status: "investigating" },
  { schemeName: "GhanaCoin Wealth Token", schemeType: "crypto", source: "whatsapp", description: "Group admin promises 25% monthly on staking.", status: "pending" },
  { schemeName: "GhanaCoin Wealth Token", schemeType: "crypto", source: "social-media", description: "TikTok videos showing fake withdrawal screenshots.", status: "pending" },
  { schemeName: "GhanaCoin Wealth Token", schemeType: "crypto", source: "friend", description: "Friend was asked to recruit five people to withdraw.", status: "investigating" },
  { schemeName: "GhanaCoin Wealth Token", schemeType: "crypto", source: "whatsapp", description: "Website went offline after I deposited.", status: "pending" },
  { schemeName: "AfriWealth Forex Academy", schemeType: "forex", source: "social-media", description: "Instagram account guaranteeing profit on managed accounts.", status: "pending" },
  { schemeName: "AfriWealth Forex Academy", schemeType: "forex", source: "whatsapp", description: "They asked me to send money to a personal MoMo number.", status: "investigating" },
  { schemeName: "QNET Ghana", schemeType: "other", source: "friend", description: "Invited to a hotel seminar, had to buy a package to join.", status: "pending" },
  { schemeName: "Little Drops Financial Services", schemeType: "ponzi", source: "other", description: "Agent came to my shop offering 40% in three months.", status: "pending" },
  { schemeName: "MMM Ghana", schemeType: "ponzi", source: "whatsapp", description: "New MMM group started again in my area.", status: "pending" },
];

const SEED_PHONES = ["233244000001", "233244000002", "233244000003", "233550000004", "233200000005"];

async function seed() {
  await connectDB();

  console.log("");
  console.log("[seed] clearing existing investments and reports...");
  await Investment.deleteMany({});
  await Report.deleteMany({});

  /* --- Licensed entities ------------------------------------------ */
  const licensed = secData.licensed.map((e) => ({
    name: e.name,
    slug: slugify(e.name),
    aliases: e.aliases || [],
    type: "other",
    riskScore: 1.5,
    secStatus: "licensed",
    secLicenseNumber: e.licenseNumber || "",
    secNote: e.category || "",
    redFlags: [],
    yearStarted: e.yearStarted || null,
    lastChecked: new Date(),
  }));

  /* --- Flagged / known scam schemes ------------------------------- */
  const warned = secData.warned.map((e) => ({
    name: e.name,
    slug: slugify(e.name),
    aliases: e.aliases || [],
    type: e.type || "other",
    riskScore: 8.5,
    secStatus: "warned",
    secNote: "Public regulator warning",
    redFlags: e.redFlags || [],
    yearStarted: e.yearStarted || null,
    lastChecked: new Date(),
  }));

  await Investment.insertMany([...licensed, ...warned]);
  console.log(`[seed] inserted ${licensed.length} licensed entities`);
  console.log(`[seed] inserted ${warned.length} flagged schemes`);

  /* --- Community reports ------------------------------------------ */
  const now = Date.now();
  const reports = SEED_REPORTS.map((r, i) => ({
    ...r,
    schemeSlug: slugify(r.schemeName),
    reporterPhone: hashPhone(SEED_PHONES[i % SEED_PHONES.length]),
    // Spread them over the last two weeks so "recent" ordering looks real.
    timestamp: new Date(now - i * 29 * 60 * 60 * 1000),
    createdAt: new Date(now - i * 29 * 60 * 60 * 1000),
  }));

  await Report.insertMany(reports);
  console.log(`[seed] inserted ${reports.length} community reports`);

  console.log("");
  console.log("[seed] ✅ done. Try these in the bot:");
  console.log("       Menzgold            -> high risk, regulator warning");
  console.log("       GhanaCoin           -> high risk, 4 community reports");
  console.log("       Databank            -> low risk, SEC licensed");
  console.log("       BTC                 -> low risk, real token via CoinGecko");
  console.log("       http://invest.tk    -> flagged domain");
  console.log("");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
