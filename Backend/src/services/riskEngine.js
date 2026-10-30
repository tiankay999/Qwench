import Investment from "../models/Investment.js";
import Report from "../models/Report.js";
import { UNAVAILABLE, lookupToken } from "./coingecko.js";
import { checkContract, isContractAddress, scoreContract } from "./goplus.js";
import { findScamKeywords, lookupSecEntity, secData, slugify } from "./secData.js";

/* ------------------------------------------------------------------ *
 * Input shape detection
 * ------------------------------------------------------------------ */

function parseQuery(raw) {
  const query = String(raw || "").trim();

  if (isContractAddress(query)) {
    return { query, kind: "contract", subject: query };
  }

  const urlMatch = query.match(/(https?:\/\/[^\s]+|(?:www\.)[^\s]+|[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?)/i);
  if (urlMatch) {
    const host = urlMatch[1].replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
    return { query, kind: "link", host, subject: host.split(".")[0] };
  }

  // Short all-caps strings look like tickers: BTC, SOL, SAFEMOON
  const looksLikeTicker = /^[A-Za-z0-9]{2,12}$/.test(query) && query === query.toUpperCase();
  return { query, kind: looksLikeTicker ? "token" : "name", subject: query };
}

function mentionsCrypto(text) {
  return /\b(coin|coins|token|tokens|crypto|bitcoin|btc|eth|usdt|bnb|staking|stake|defi|nft|mining|wallet)\b/i.test(
    text
  );
}

/* ------------------------------------------------------------------ *
 * Bands and copy
 * ------------------------------------------------------------------ */

function levelFor(score) {
  if (score <= 3) return { riskLevel: "LOW RISK", color: "green", emoji: "🟢" };
  if (score <= 6) return { riskLevel: "MEDIUM RISK", color: "amber", emoji: "🟡" };
  return { riskLevel: "HIGH RISK", color: "red", emoji: "🔴" };
}

function recommendationFor({ level, name, status, isCrypto, honeypot }) {
  if (honeypot) {
    return `Do not buy this token. The contract is built so you can buy but cannot sell -- your money would be unrecoverable.`;
  }
  if (status === "blacklisted") {
    return `We strongly advise against investing in this scheme. SEC Ghana has publicly warned against it and it is not licensed to take your money.`;
  }
  if (status === "revoked") {
    return `${name} no longer holds a valid SEC Ghana licence. Do not place new money with them and seek advice on recovering any funds already committed.`;
  }
  if (level === "LOW RISK" && isCrypto) {
    return `${name} is a real, widely traded asset -- but crypto prices swing hard and nobody in Ghana insures your loss. Use a reputable exchange, never an individual promising fixed returns.`;
  }
  if (level === "LOW RISK") {
    return `${name} appears on the SEC Ghana licensed list. Still confirm the licence yourself at sec.gov.gh and never pay into a personal mobile money wallet.`;
  }
  if (level === "MEDIUM RISK" && isCrypto) {
    return `${name} is tradeable but carries real risk — check the specific warnings above before you buy, and never invest money you cannot afford to lose.`;
  }
  if (level === "MEDIUM RISK") {
    return `We could not fully verify ${name}. Ask for their SEC Ghana licence number and verify it at sec.gov.gh before you invest anything.`;
  }
  return `We strongly advise against investing in this scheme.`;
}

/* ------------------------------------------------------------------ *
 * Main entry point
 * ------------------------------------------------------------------ */

export async function runRiskCheck(rawQuery) {
  const parsed = parseQuery(rawQuery);
  const slug = slugify(parsed.subject);
  console.log(`[risk] checking "${parsed.query}" (detected as ${parsed.kind})`);

  const redFlags = [];
  const greenFlags = [];
  const factors = {};
  let score = 0;

  /* --- 1. Our own stored record ----------------------------------- */
  const known = await Investment.findOne({
    $or: [{ slug }, { aliases: slug }, { name: new RegExp(`^${escapeRegex(parsed.subject)}$`, "i") }],
  }).lean();

  if (known) console.log(`[risk] matched stored entity: ${known.name} (${known.status})`);

  const secEntity = lookupSecEntity(parsed.subject);

  /* --- 2. Smart contract check (GoPlus) --------------------------- */
  // Only for an actual 0x address, as specified.
  const isContract = parsed.kind === "contract";
  const contract = isContract ? await checkContract(parsed.subject) : null;

  /* --- 3. Crypto market data (CoinGecko) -------------------------- */
  // Only curated records count as a local match -- records this engine cached
  // itself carry status "unknown" and must not suppress a live lookup.
  const localMatch = Boolean(secEntity) || (known != null && known.status !== "unknown");
  const curatedCategory = secEntity?.category || (known && known.status !== "unknown" ? known.category : null);

  // A curated entry settles the question. Without one, a ticker-shaped query or
  // crypto wording is our hint -- otherwise short acronyms like "CDH" get
  // mistaken for token symbols.
  const hintsCrypto =
    parsed.kind === "contract" ||
    curatedCategory === "crypto" ||
    (!curatedCategory && (parsed.kind === "token" || mentionsCrypto(parsed.query)));
  const flagged = known?.status === "blacklisted" || secEntity?.status === "blacklisted";

  const tokenSubject = contract?.tokenSymbol || parsed.subject;
  const shouldLookupToken =
    !flagged && parsed.kind !== "link" && (hintsCrypto || !localMatch) && (parsed.kind !== "contract" || Boolean(contract));

  let token = shouldLookupToken ? await lookupToken(tokenSubject) : null;

  // Tell "CoinGecko says this does not exist" apart from "we could not reach
  // CoinGecko". Only the first is evidence against the token.
  const marketDataUnavailable = token === UNAVAILABLE;
  if (marketDataUnavailable) token = null;

  // CoinGecko search is fuzzy, so when we were only guessing this might be a
  // token, require the result to actually match what the user typed.
  if (token && !hintsCrypto && !isTokenMatch(token, parsed.subject)) {
    console.log(`[risk] ignoring loose CoinGecko match "${token.name}" for "${parsed.subject}"`);
    token = null;
  }

  const treatAsCrypto = hintsCrypto || Boolean(token);
  const establishedToken = Boolean(token && token.marketCapRank && token.marketCapRank <= 500);

  /* --- 3b. Score the contract, now that we know the market context - */
  if (isContract) {
    if (contract) {
      const { points, flags, greenFlags: good } = scoreContract(contract);

      // Honeypots are absolute. The other permissions are real but are also
      // normal for big centralised tokens (USDT can freeze wallets), so for an
      // established asset they weigh far less than they do on an unknown one.
      const honeypotPoints = contract.isHoneypot ? 6 : 0;
      const otherPoints = points - honeypotPoints;
      const damped = establishedToken ? otherPoints * 0.35 : otherPoints;

      factors.contract = Math.min(10, honeypotPoints + damped);
      redFlags.push(...flags);
      greenFlags.push(...good);

      if (contract.holderCount != null && contract.holderCount < 100) {
        factors.contract = Math.min(10, factors.contract + 1);
        redFlags.push(`Only ${contract.holderCount} holders — very easy for the owner to move the price`);
      }
    } else {
      factors.contract = 7;
      redFlags.push("Contract address is not recognised on Ethereum, BSC or Polygon — treat it as unverified");
    }
    score += factors.contract;
  }

  /* --- 4. SEC Ghana status (heaviest weight, max 5) --------------- */
  let status = known?.status || secEntity?.status || "unknown";
  const source = known?.source || secEntity?.source || "";
  const licenseType = known?.licenseType || secEntity?.licenseType || "";
  let statusLabel;

  if (status === "licensed") {
    statusLabel = licenseType
      ? `Licensed by SEC Ghana as a ${licenseType}`
      : "Licensed by SEC Ghana";
    greenFlags.push(`On the SEC Ghana licensed list${licenseType ? ` as a ${licenseType}` : ""}`);
    factors.status = 0;
  } else if (status === "blacklisted") {
    statusLabel = `Blacklisted — publicly warned against by ${source || "SEC Ghana"}`;
    redFlags.push(blacklistFlagText(source));
    factors.status = 5;
  } else if (status === "revoked") {
    statusLabel = "SEC Ghana licence revoked — no longer authorised";
    redFlags.push("SEC Ghana licence has been revoked");
    factors.status = 4.5;
  } else if (establishedToken || isContract) {
    // Crypto is not a licensed product category in Ghana, so a missing licence
    // is expected here rather than a fraud signal.
    statusLabel = "Crypto assets are not SEC Ghana licensed products — no licence expected";
    redFlags.push("Not covered by SEC Ghana investor protection — you carry the full risk");
    factors.status = 1.5;
    status = "unknown";
  } else {
    statusLabel = "Not on the SEC Ghana licensed list";
    redFlags.push("Not licensed by SEC Ghana to take investments");
    factors.status = 2.5;
    status = "unknown";
  }
  score += factors.status;

  /* --- 5. Age / track record (max 1.5) ---------------------------- */
  const ageDays = token?.ageDays ?? null;
  const dateAdded = known?.dateAdded || (secEntity?.dateAdded ? new Date(secEntity.dateAdded) : null);

  if (status === "blacklisted" || status === "revoked") {
    // A flagged scheme gets no credit for having been around a long time.
    factors.age = 0.5;
  } else if (ageDays != null && ageDays < 30) {
    factors.age = 1.5;
    redFlags.push(`Token is only ${ageDays} day${ageDays === 1 ? "" : "s"} old`);
  } else if (ageDays != null && ageDays < 365) {
    factors.age = 0.8;
    redFlags.push(`Token is less than a year old (${ageDays} days)`);
  } else if (ageDays != null) {
    factors.age = 0;
    greenFlags.push(`Trading for about ${Math.floor(ageDays / 365)} years`);
  } else if (establishedToken || status === "licensed") {
    factors.age = 0;
  } else if (token) {
    // CoinGecko often has no genesis date. Real market depth stands in for a
    // track record, and the market thresholds below judge it instead.
    factors.age = 0;
  } else if (isContract) {
    // The contract check already covers an unverified address; do not also
    // charge it the "no company history" penalty.
    factors.age = 0;
  } else {
    factors.age = 1;
    redFlags.push("No verifiable trading history or registration date");
  }
  score += factors.age;

  /* --- 6. Promised returns / scam language (max 1.5) -------------- */
  const haystack = [parsed.query, ...(known?.redFlags || []), ...(secEntity?.redFlags || [])].join(" ");
  const keywords = findScamKeywords(haystack);
  const returnPromise = /(\d{1,3})\s?%/.exec(haystack);

  if (keywords.length || returnPromise) {
    factors.returns = Math.min(1.5, 0.6 * keywords.length + (returnPromise ? 0.9 : 0));
    if (returnPromise) {
      redFlags.push(`Advertises returns of ${returnPromise[1]}% — far above any licensed Ghanaian product`);
    }
    if (keywords.length) {
      redFlags.push(`Uses classic scam wording: "${keywords.slice(0, 2).join('", "')}"`);
    }
  } else {
    factors.returns = 0;
  }
  score += factors.returns;

  /* --- 7. Community reports (max 2) ------------------------------- */
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

  /* --- 8. Market presence / online footprint (max 2.5) ------------ */
  factors.presence = 0;

  if (treatAsCrypto && token) {
    if (token.marketCapUsd > 0 && token.marketCapUsd < 100_000) {
      factors.presence += 1.5;
      redFlags.push(`Market cap is only $${fmt(token.marketCapUsd)} — tiny enough for one holder to crash it`);
    }
    if (token.volume24hUsd < 10_000) {
      factors.presence += 1;
      redFlags.push(`24h trading volume is only $${fmt(token.volume24hUsd)} — you may not be able to sell`);
    }
    if (!token.homepage && token.socialCount === 0) {
      factors.presence += 0.8;
      redFlags.push("No website and no social channels — no team to hold accountable");
    }
    if (token.exchangeCount === 0) {
      factors.presence += 0.5;
      redFlags.push("Not listed on any tracked exchange");
    }
    if (establishedToken && factors.presence === 0) {
      greenFlags.push(
        `${token.symbol} is ranked #${token.marketCapRank} by market cap with $${fmt(token.volume24hUsd)} traded in 24h`
      );
    }
  } else if (treatAsCrypto && !token && marketDataUnavailable) {
    // We could not check, so say so rather than implying the token is fake.
    redFlags.push("Live market data could not be checked just now — treat this result as incomplete");
  } else if (treatAsCrypto && !token && parsed.kind !== "contract") {
    factors.presence += 1.5;
    redFlags.push("Token does not exist on CoinGecko — no real market data behind it");
  } else if (parsed.kind === "link") {
    const tld = secData.suspiciousTlds.find((t) => parsed.host.endsWith(t));
    if (tld) {
      factors.presence += 1;
      redFlags.push(`Website uses the ${tld} domain, common in throwaway scam sites`);
    }
    if (secData.linkShorteners.some((s) => parsed.host === s)) {
      factors.presence += 0.8;
      redFlags.push("Shared through a link shortener that hides the real destination");
    }
  } else if (status === "unknown" && !localMatch && !isContract) {
    factors.presence += 0.8;
    redFlags.push("No verifiable team, office address or online footprint found");
  }

  factors.presence = Math.min(2.5, factors.presence);
  score += factors.presence;

  /* --- Overrides and clamping ------------------------------------- */
  // A licensed entity with no real community complaints cannot be high risk.
  if (status === "licensed" && reportCount < 3) score = Math.min(score, 2.5);

  // Conversely, an entity SEC Ghana has publicly warned against is high risk
  // regardless of anything else.
  if (status === "blacklisted") score = Math.max(score, 8);
  if (status === "revoked") score = Math.max(score, 7);

  // A honeypot is the most severe thing we can detect.
  if (contract?.isHoneypot) score = Math.max(score, 9.5);

  score = Math.max(0.5, Math.min(10, Number(score.toFixed(1))));
  const { riskLevel, color, emoji } = levelFor(score);

  const name = known?.name || secEntity?.name || contract?.tokenName || token?.name || titleCase(parsed.subject);
  const category = known?.category || secEntity?.category || (treatAsCrypto ? "crypto" : "other");

  // Prefer hand-written red flags for curated entities -- they read better.
  // Flags this engine derived itself are never reused: they go stale, and a
  // flag from a degraded earlier run must not resurface as fact.
  const curated =
    known && known.status !== "unknown" && known.redFlags?.length ? known.redFlags : secEntity?.redFlags || [];

  // Most blacklisted entities have no hand-written notes, so spell out what
  // being on the warning list actually means for the reader.
  const generic = !curated.length && status === "blacklisted" ? genericBlacklistFlags(category, source) : [];

  // The generic set already states the warning and its source, so drop the
  // one-line version we added during scoring.
  const scored = generic.length ? redFlags.filter((f) => f !== blacklistFlagText(source)) : redFlags;

  const finalFlags = dedupe([...curated, ...generic, ...scored]).slice(0, 6);

  const result = {
    name,
    query: parsed.query,
    slug,
    queryKind: parsed.kind,
    category,
    status,
    statusLabel,
    source,
    licenseType,
    dateAdded,
    riskScore: score,
    riskLevel,
    color,
    emoji,
    redFlags: finalFlags,
    greenFlags: dedupe(greenFlags).slice(0, 4),
    reportCount,
    recommendation: recommendationFor({
      level: riskLevel,
      name,
      status,
      isCrypto: treatAsCrypto,
      honeypot: contract?.isHoneypot,
    }),
    coingecko: token,
    contract,
    factors,
    checkedAt: new Date().toISOString(),
    disclaimer:
      "Qwench is an awareness tool, not financial advice. Always verify licences directly with SEC Ghana at sec.gov.gh.",
  };

  console.log(
    `[risk] "${parsed.query}" -> ${score}/10 ${riskLevel} (status: ${status}, reports: ${reportCount}, flags: ${finalFlags.length})`
  );

  // Cache the result under the canonical slug, remembering the query as an
  // alias so we do not end up with one document per spelling. Curated entries
  // are never downgraded by this.
  if (status === "unknown") {
    const storeSlug = slugify(name) || slug;
    await Investment.updateOne(
      { slug: storeSlug },
      {
        $addToSet: { aliases: slug },
        $set: {
          name,
          slug: storeSlug,
          category,
          status,
          source: "Qwench risk engine",
          riskScore: score,
          // Deliberately not storing redFlags: they are derived per check and
          // would go stale. Only curated entries carry hand-written flags.
          lastChecked: new Date(),
        },
      },
      { upsert: true }
    ).catch((err) => console.warn(`[risk] could not cache entity: ${err.message}`));
  } else {
    await Investment.updateOne({ slug: slugify(canonicalName) }, { $set: { lastChecked: new Date() } }).catch(
      () => {}
    );
  }

  return result;
}

/* ------------------------------------------------------------------ */

function blacklistFlagText(source) {
  return `Named in a ${source || "SEC Ghana"} public warning as unlicensed`;
}

/**
 * What it means to be on the SEC Ghana warning list, for an entity we hold no
 * hand-written notes on.
 */
function genericBlacklistFlags(category, source) {
  const by = source || "SEC Ghana";
  const flags = [
    `Not licensed by SEC Ghana to take deposits or investments from the public`,
    `${by} has published a public warning telling people not to invest`,
  ];

  if (category === "forex") {
    flags.push("Unlicensed forex / binary trading platform marketed to Ghanaians");
  } else if (category === "crypto") {
    flags.push("Unlicensed crypto scheme -- no regulator can recover your money");
  } else if (category === "ponzi") {
    flags.push("Pays earlier members from new members' deposits, which always collapses");
  } else {
    flags.push("Any promise of guaranteed returns from this entity is unlawful in Ghana");
  }

  flags.push("You would have no legal protection if your money disappears");
  return flags;
}

function isTokenMatch(token, subject) {
  const q = slugify(subject);
  return slugify(token.name) === q || String(token.symbol).toLowerCase() === q;
}

function fmt(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

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
