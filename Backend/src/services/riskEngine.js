import Investment from "../models/Investment.js";
import Report from "../models/Report.js";
import { lookupToken } from "./coingecko.js";
import { findScamKeywords, lookupSecEntity, secData, slugify } from "./secData.js";

const CURRENT_YEAR = new Date().getFullYear();

/* ------------------------------------------------------------------ *
 * Input shape detection
 * ------------------------------------------------------------------ */

function parseQuery(raw) {
  const query = String(raw || "").trim();
  const urlMatch = query.match(/(https?:\/\/[^\s]+|(?:www\.)[^\s]+|[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?)/i);

  if (urlMatch) {
    let host = urlMatch[1].replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
    return { query, kind: "link", host, subject: host.split(".")[0] };
  }

  // Short all-caps strings look like tickers: BTC, GHC, SAFEMOON
  const looksLikeTicker = /^[A-Za-z0-9]{2,12}$/.test(query) && query === query.toUpperCase();
  return { query, kind: looksLikeTicker ? "token" : "name", subject: query };
}

function mentionsCrypto(text) {
  return /\b(coin|token|crypto|bitcoin|btc|eth|usdt|bnb|staking|stake|defi|nft|mining)\b/i.test(text);
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

function levelFor(score) {
  if (score <= 3) return { riskLevel: "LOW RISK", color: "green", emoji: "🟢" };
  if (score <= 6) return { riskLevel: "MEDIUM RISK", color: "amber", emoji: "🟡" };
  return { riskLevel: "HIGH RISK", color: "red", emoji: "🔴" };
}

function recommendationFor(level, name) {
  if (level === "LOW RISK") {
    return `${name} looks legitimate. Still confirm the licence yourself at sec.gov.gh and never pay into a personal mobile money wallet.`;
  }
  if (level === "MEDIUM RISK") {
    return `We could not fully verify ${name}. Ask for their SEC Ghana licence number and verify it at sec.gov.gh before you invest anything.`;
  }
  return `We strongly advise against investing in this scheme.`;
}

/**
 * Run the full risk check for a query.
 * Every factor adds points; the total is clamped to 0-10.
 */
export async function runRiskCheck(rawQuery) {
  const parsed = parseQuery(rawQuery);
  const slug = slugify(parsed.subject);
  console.log(`[risk] checking "${parsed.query}" (detected as ${parsed.kind})`);

  const redFlags = [];
  const greenFlags = [];
  const factors = {};
  let score = 0;

  /* --- 1. Known record in our own database ------------------------ */
  const known = await Investment.findOne({
    $or: [{ slug }, { aliases: slug }, { name: new RegExp(`^${escapeRegex(parsed.subject)}$`, "i") }],
  }).lean();

  if (known) console.log(`[risk] matched stored investment: ${known.name}`);

  const secEntity = lookupSecEntity(parsed.subject);

  /* --- 2. Crypto market data (needed by the factors below) -------- */
  const hintsCrypto =
    parsed.kind === "token" || known?.type === "crypto" || secEntity?.type === "crypto" || mentionsCrypto(parsed.query);
  const localMatch = Boolean(known || secEntity);
  const flagged = known?.secStatus === "warned" || secEntity?.secStatus === "warned";

  // Names we do not recognise locally also get a token lookup -- that is how
  // "Ethereum" or "Solana" are picked up without being spelled as tickers.
  // A flagged scheme stays flagged even if it shares a name with a real token.
  const shouldLookupToken = !flagged && parsed.kind !== "link" && (hintsCrypto || !localMatch);
  let token = shouldLookupToken ? await lookupToken(parsed.subject) : null;

  // CoinGecko search is fuzzy, so when we were only guessing that this might be
  // a token, require the result to actually match what the user typed.
  if (token && !hintsCrypto && !isTokenMatch(token, parsed.subject)) {
    console.log(`[risk] ignoring loose CoinGecko match "${token.name}" for "${parsed.subject}"`);
    token = null;
  }

  const treatAsCrypto = hintsCrypto || Boolean(token);
  const establishedToken = Boolean(token && token.marketCapRank && token.marketCapRank <= 500);

  /* --- 3. SEC Ghana status (heaviest weight, max 5) --------------- */
  let secStatus = known?.secStatus || secEntity?.secStatus || "unknown";
  let secLabel;
  let secLicenseNumber = known?.secLicenseNumber || secEntity?.licenseNumber || "";

  if (secStatus === "licensed") {
    secLabel = secLicenseNumber
      ? `Licensed by SEC Ghana (${secEntity?.category || "licensed entity"}, ref ${secLicenseNumber})`
      : "Licensed by SEC Ghana";
    greenFlags.push("Appears on the SEC Ghana list of licensed entities");
    factors.sec = 0;
  } else if (secStatus === "warned") {
    secLabel = "Flagged in SEC Ghana / regulator public warnings";
    redFlags.push("Subject of a regulator warning or shutdown order");
    factors.sec = 5;
  } else if (secStatus === "not-licensed") {
    secLabel = "Not licensed by SEC Ghana";
    redFlags.push("Not registered with SEC Ghana");
    factors.sec = 4;
  } else if (establishedToken) {
    // Crypto is not a licensed product category in Ghana, so a missing licence
    // is expected here rather than a fraud signal.
    secLabel = "Crypto assets are not SEC Ghana licensed products -- no licence expected";
    redFlags.push("Not covered by SEC Ghana investor protection -- you carry the full risk");
    factors.sec = 1.5;
    secStatus = "unknown";
  } else {
    secLabel = "No SEC Ghana licence found for this name";
    redFlags.push("Could not find an SEC Ghana licence under this name");
    factors.sec = 2.5;
    secStatus = "unknown";
  }
  score += factors.sec;

  /* --- 4. Age (max 1.5) ------------------------------------------- */
  const genesisYear = token?.genesisDate ? Number(String(token.genesisDate).slice(0, 4)) : null;
  const yearStarted = known?.yearStarted || secEntity?.yearStarted || genesisYear || null;
  const age = yearStarted ? CURRENT_YEAR - yearStarted : null;

  if (secStatus === "warned") {
    // A collapsed or flagged scheme gets no credit for having been around a long time.
    factors.age = 0.5;
  } else if (age === null && establishedToken) {
    factors.age = 0;
  } else if (age === null) {
    factors.age = 1;
    redFlags.push("No verifiable trading history or registration date");
  } else if (age < 1) {
    factors.age = 1.5;
    redFlags.push("Less than a year old");
  } else if (age < 3) {
    factors.age = 0.8;
    redFlags.push(`Only ${age} year${age === 1 ? "" : "s"} old`);
  } else {
    factors.age = 0;
    greenFlags.push(`Operating for about ${age} years`);
  }
  score += factors.age;

  /* --- 5. Promised returns / scam language (max 1.5) -------------- */
  const haystack = [parsed.query, ...(known?.redFlags || []), ...(secEntity?.redFlags || [])].join(" ");
  const keywords = findScamKeywords(haystack);
  const returnPromise = /(\d{1,3})\s?%/.exec(haystack);

  if (keywords.length || returnPromise) {
    factors.returns = Math.min(1.5, 0.6 * keywords.length + (returnPromise ? 0.9 : 0));
    if (returnPromise) {
      redFlags.push(`Advertises returns of ${returnPromise[1]}% -- far above any licensed Ghanaian product`);
    }
    if (keywords.length) {
      redFlags.push(`Uses classic scam wording: "${keywords.slice(0, 2).join('", "')}"`);
    }
  } else {
    factors.returns = 0;
  }
  score += factors.returns;

  /* --- 6. Community reports (max 2) ------------------------------- */
  // Reports are filed under whatever name the reporter typed, so match the
  // canonical name and every known alias, not just the raw query.
  const canonicalName = known?.name || secEntity?.name || parsed.subject;
  const slugCandidates = dedupe([
    slug,
    slugify(canonicalName),
    ...(known?.aliases || []).map(slugify),
    ...(secEntity?.aliases || []).map(slugify),
  ]);

  const reportCount = await Report.countDocuments({ schemeSlug: { $in: slugCandidates } });
  if (reportCount >= 5) factors.reports = 2;
  else if (reportCount >= 3) factors.reports = 1.5;
  else if (reportCount >= 1) factors.reports = 1;
  else factors.reports = 0;

  if (reportCount > 0) {
    redFlags.push(`${reportCount} community report${reportCount === 1 ? "" : "s"} from other Qwench users`);
  }
  score += factors.reports;

  /* --- 7. Online presence (max 1.5) ------------------------------- */
  if (treatAsCrypto) {
    if (!token) {
      factors.presence = 1.5;
      redFlags.push("Token does not exist on CoinGecko -- no real market data");
    } else if (!token.marketCapRank || token.marketCapUsd < 1_000_000) {
      factors.presence = 1;
      redFlags.push(`${token.symbol} is unranked with a very small market cap -- easy to manipulate`);
    } else if (token.marketCapRank > 500) {
      factors.presence = 0.5;
      redFlags.push(`${token.symbol} ranks #${token.marketCapRank} by market cap -- thinly traded`);
    } else {
      factors.presence = 0;
      greenFlags.push(`${token.symbol} is a real asset ranked #${token.marketCapRank} on CoinGecko`);
    }
  } else if (parsed.kind === "link") {
    factors.presence = 0;
    const tld = secData.suspiciousTlds.find((t) => parsed.host.endsWith(t));
    if (tld) {
      factors.presence += 1;
      redFlags.push(`Website uses the ${tld} domain, common in throwaway scam sites`);
    }
    if (secData.linkShorteners.some((s) => parsed.host === s)) {
      factors.presence += 0.8;
      redFlags.push("Shared through a link shortener that hides the real destination");
    }
    factors.presence = Math.min(1.5, factors.presence);
  } else if (!known && !secEntity) {
    factors.presence = 0.8;
    redFlags.push("No verifiable team, office address or online footprint found");
  } else {
    factors.presence = 0;
  }
  score += factors.presence;

  /* --- Clamp and finalise ----------------------------------------- */
  // A licensed entity with no community complaints cannot come out as high risk.
  if (secStatus === "licensed" && reportCount < 3) score = Math.min(score, 2.5);

  // Conversely, a scheme under a regulator warning is high risk whatever else
  // it has going for it.
  if (secStatus === "warned") score = Math.max(score, 7.5);

  // Nothing is truly zero risk.
  score = Math.max(0.5, Math.min(10, Number(score.toFixed(1))));
  const { riskLevel, color, emoji } = levelFor(score);

  // Prefer the curated red flags for known bad schemes -- they read better in the demo.
  const curated = known?.redFlags?.length ? known.redFlags : secEntity?.redFlags || [];
  const finalFlags = dedupe([...curated, ...redFlags]).slice(0, 5);

  const name = known?.name || secEntity?.name || token?.name || titleCase(parsed.subject);
  const type = known?.type || secEntity?.type || (treatAsCrypto ? "crypto" : "other");

  const result = {
    name,
    query: parsed.query,
    slug,
    queryKind: parsed.kind,
    type,
    riskScore: score,
    riskLevel,
    color,
    emoji,
    secStatus,
    secLabel,
    secLicenseNumber,
    redFlags: finalFlags,
    greenFlags: dedupe(greenFlags).slice(0, 4),
    reportCount,
    recommendation: recommendationFor(riskLevel, name),
    coingecko: token,
    factors,
    checkedAt: new Date().toISOString(),
    disclaimer:
      "Qwench is an awareness tool, not financial advice. Always verify licences directly with SEC Ghana at sec.gov.gh.",
  };

  console.log(`[risk] "${parsed.query}" -> ${score}/10 ${riskLevel} (sec: ${secStatus}, reports: ${reportCount})`);

  // Keep our own record fresh so repeat lookups are instant. Store it under the
  // canonical slug and remember the query as an alias, so we do not end up with
  // one document per spelling.
  const storeSlug = slugify(name) || slug;
  await Investment.updateOne(
    { slug: storeSlug },
    {
      $addToSet: { aliases: slug },
      $set: {
        name,
        slug: storeSlug,
        type,
        riskScore: score,
        secStatus,
        secLicenseNumber,
        redFlags: finalFlags,
        yearStarted,
        lastChecked: new Date(),
      },
    },
    { upsert: true }
  ).catch((err) => console.warn(`[risk] could not cache investment: ${err.message}`));

  return result;
}

/* ------------------------------------------------------------------ */

function dedupe(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleCase(s) {
  return String(s)
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
