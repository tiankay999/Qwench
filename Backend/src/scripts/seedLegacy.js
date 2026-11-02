// DEPRECATED — this seeded the old Investment/Report/LegacyCheck collections.
// The register now lives in the new data model; see src/scripts/seed.js, which
// populates sources, entities, identifiers, records, relations and orgs.
// Kept only so the previous demo data can still be reproduced if needed.

import "dotenv/config";

import crypto from "node:crypto";
import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import LegacyCheck from "../models/LegacyCheck.js";
import Investment from "../models/Investment.js";
import Report from "../models/Report.js";
import { bootstrapSecData } from "../services/bootstrapData.js";
import { slugify } from "../services/secData.js";

function hashPhone(phone) {
  const salt = process.env.PHONE_HASH_SALT;
  return crypto.createHash("sha256").update(`${salt}:${phone}`).digest("hex");
}

// Community reports, so /api/trending has real content on day one. These are
// demo reports against entities that are genuinely on the SEC Ghana list.
const SEED_REPORTS = [
  { schemeName: "Menzgold Ghana Limited", schemeType: "ponzi", source: "friend", description: "My uncle lost GHS 20,000 and was never paid back.", status: "confirmed" },
  { schemeName: "Menzgold Ghana Limited", schemeType: "ponzi", source: "whatsapp", description: "Agents are still recruiting in WhatsApp groups.", status: "confirmed" },
  { schemeName: "Menzgold Ghana Limited", schemeType: "ponzi", source: "social-media", description: "Facebook ads promising gold dividends again.", status: "investigating" },
  { schemeName: "Ultima Cryptocurrency Group", schemeType: "crypto", source: "whatsapp", description: "Group admin promises 25% monthly on staking.", status: "pending" },
  { schemeName: "Ultima Cryptocurrency Group", schemeType: "crypto", source: "social-media", description: "TikTok videos showing fake withdrawal screenshots.", status: "pending" },
  { schemeName: "Ultima Cryptocurrency Group", schemeType: "crypto", source: "friend", description: "Friend was asked to recruit five people before withdrawing.", status: "investigating" },
  { schemeName: "Ultima Cryptocurrency Group", schemeType: "crypto", source: "whatsapp", description: "Website went offline after I deposited.", status: "pending" },
  { schemeName: "ZEC ZEC FX", schemeType: "forex", source: "social-media", description: "Instagram account guaranteeing profit on managed accounts.", status: "pending" },
  { schemeName: "ZEC ZEC FX", schemeType: "forex", source: "whatsapp", description: "They asked me to send money to a personal MoMo number.", status: "investigating" },
  { schemeName: "Solmax Group", schemeType: "ponzi", source: "friend", description: "Invited to a hotel seminar, had to buy a package to join.", status: "pending" },
  { schemeName: "Quick Earn", schemeType: "investment", source: "other", description: "Agent came to my shop offering 40% in three months.", status: "pending" },
  { schemeName: "Cedi Network Ghana", schemeType: "ponzi", source: "whatsapp", description: "New group started recruiting in my area.", status: "pending" },
  { schemeName: "Profit Rise Invest", schemeType: "investment", source: "social-media", description: "Sponsored posts promising daily ROI.", status: "pending" },
  { schemeName: "Yepbit Trading", schemeType: "crypto", source: "whatsapp", description: "Could not withdraw after depositing GHS 5,000.", status: "investigating" },
];

const SEED_PHONES = ["233244000001", "233244000002", "233244000003", "233550000004", "233200000005"];

async function seed() {
  await connectDB();

  console.log("");
  console.log("[seed] clearing investments, reports and checks...");
  await Promise.all([Investment.deleteMany({}), Report.deleteMany({}), LegacyCheck.deleteMany({})]);

  // The SEC Ghana register itself is loaded by the same routine the server uses
  // on start, so there is only one definition of that data.
  await bootstrapSecData();

  const now = Date.now();
  const reports = SEED_REPORTS.map((r, i) => ({
    ...r,
    schemeSlug: slugify(r.schemeName),
    reporterPhone: hashPhone(SEED_PHONES[i % SEED_PHONES.length]),
    // Spread over the last two weeks so "recent" ordering looks real.
    timestamp: new Date(now - i * 25 * 60 * 60 * 1000),
    createdAt: new Date(now - i * 25 * 60 * 60 * 1000),
  }));

  await Report.insertMany(reports);
  console.log(`[seed] inserted ${reports.length} community reports`);

  console.log("");
  console.log("[seed] ✅ done. Try these in the bot:");
  console.log("       Menzgold          -> blacklisted, 3 community reports");
  console.log("       Expert Option     -> blacklisted (SEC July 2026 notice)");
  console.log("       Solmax            -> blacklisted (SEC Ghana & EOCO)");
  console.log("       Databank          -> licensed Fund Manager");
  console.log("       IC Securities     -> licensed Broker-Dealer");
  console.log("       BTC               -> live CoinGecko market data");
  console.log("       0x<address>       -> GoPlus contract security check");
  console.log("");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
