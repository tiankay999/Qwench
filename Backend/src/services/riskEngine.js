import Investment from "../models/Investment.js";
import Report from "../models/Report.js";
import { analyzeWithAI, verdictForScore } from "./aiAnalyzer.js";
import { UNAVAILABLE, lookupToken } from "./coingecko.js";
import { checkContract, isContractAddress, scoreContract } from "./goplus.js";
import { findScamKeywords, lookupSecEntity, secData, slugify } from "./secData.js";

const EMOJI = { green: "🟢", yellow: "🟡", orange: "🟠", red: "🔴" };
const LEVEL_TEXT = { LOW: "LOW RISK", MEDIUM: "MEDIUM RISK", HIGH: "HIGH RISK", CRITICAL: "CRITICAL RISK" };

/* ------------------------------------------------------------------ *
 * Input shape detection
 * ------------------------------------------------------------------ */

function parseQuery(raw) {
  const query = String(raw || "").trim();

  if (isContractAddress(query)) return { query, kind: "contract", subject: query };

  const urlMatch = query.match(/(https?:\/\/[^\s]+|(?:www\.)[^\s]+|[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?)/i);
  if (urlMatch) {
    const host = urlMatch[1].replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
    return { query, kind: "link", host, subject: host.split(".")[0] };
  }

  const looksLikeTicker = /^[A-Za-z0-9]{2,12}$/.test(query) && query === query.toUpperCase();
  return { query, kind: looksLikeTicker ? "token" : "name", subject: query };
}

function mentionsCrypto(text) {
  return /\b(coin|coins|token|tokens|crypto|bitcoin|btc|eth|usdt|bnb|staking|stake|defi|nft|mining|wallet)\b/i.test(
    text
  );
}

/* ------------------------------------------------------------------ *
 * Step 1 -- gather raw data from every source
 * ------------------------------------------------------------------ */

/**
 * Collects the raw evidence the AI analyzer reasons over. No scoring happens
 * here: this is purely "what do all our sources say about this query".
 */
export async function gatherEvidence(rawQuery, additionalContext = "") {
  const parsed = parseQuery(rawQuery);
  const slug = slugify(parsed.subject);
  console.log(`[risk] gathering evidence for "${parsed.query}" (detected as ${parsed.kind})`);

  /* --- SEC Ghana: our MongoDB register ---------------------------- */
  const known = await Investment.findOne({
    $or: [{ slug }, { aliases: slug }, { name: new RegExp(`^${escapeRegex(parsed.subject)}$`, "i") }],
  }).lean();

  const fileEntity = lookupSecEntity(parsed.subject);

  // Only curated records are authoritative. Records the engine cached itself
  // carry status "unknown" and must not suppress the live lookups.
  const curated = fileEntity || (known && known.status !== "unknown" ? known : null);
  if (curated) console.log(`[risk] matched SEC register: ${curated.name} (${curated.status})`);

  const secLookup = {
    found: Boolean(curated),
    name: curated?.name || null,
    // "unregistered" is the vocabulary the AI prompt uses for "not on any list"
    status: curated?.status || "unregistered",
    source: curated?.source || null,
    licenseType: curated?.licenseType || null,
    category: curated?.category || null,
    dateAdded: curated?.dateAdded || fileEntity?.dateAdded || null,
    aliases: curated?.aliases || [],
    curatedRedFlags: curated?.redFlags || [],
    note:
      curated?.status === "sandbox"
        ? "Provisional approval only under the SEC Ghana virtual asset sandbox (Act 1154). This is NOT a full licence."
        : curated?.status === "unregistered" || !curated
          ? "Not found on the SEC Ghana licensed list, sandbox list, or public warning lists."
          : null,
  };

  /* --- GoPlus: contract security (0x addresses only) -------------- */
  const isContract = parsed.kind === "contract";
  const goPlusData = isContract ? await checkContract(parsed.subject) : null;

  /* --- CoinGecko: market data ------------------------------------- */
  const curatedCategory = curated?.category || null;
  const hintsCrypto =
    isContract ||
    curatedCategory === "crypto" ||
    (!curatedCategory && (parsed.kind === "token" || mentionsCrypto(parsed.query)));

  const flagged = curated?.status === "blacklisted";
  const tokenSubject = goPlusData?.tokenSymbol || parsed.subject;
  const shouldLookupToken =
    !flagged && parsed.kind !== "link" && (hintsCrypto || !curated) && (!isContract || Boolean(goPlusData));

  let coinGeckoData = shouldLookupToken ? await lookupToken(tokenSubject) : null;

  // "CoinGecko says this does not exist" is evidence; "we could not reach
  // CoinGecko" is not. Keep them apart.
  const marketDataUnavailable = coinGeckoData === UNAVAILABLE;
  if (marketDataUnavailable) coinGeckoData = null;

  if (coinGeckoData && !hintsCrypto && !isTokenMatch(coinGeckoData, parsed.subject)) {
    console.log(`[risk] ignoring loose CoinGecko match "${coinGeckoData.name}" for "${parsed.subject}"`);
    coinGeckoData = null;
  }

  /* --- Community reports from MongoDB ----------------------------- */
  const canonicalName = curated?.name || parsed.subject;
  const slugCandidates = dedupe([
    slug,
    slugify(canonicalName),
    ...(curated?.aliases || []).map(slugify),
  ]);

  const reportDocs = await Report.find({ schemeSlug: { $in: slugCandidates } }, { reporterPhone: 0 })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
  const reportCount = await Report.countDocuments({ schemeSlug: { $in: slugCandidates } });

  const communityReports = {
    count: reportCount,
    recentComments: reportDocs.map((r) => r.description).filter(Boolean),
    sources: dedupe(reportDocs.map((r) => r.source)),
  };

  console.log(
    `[risk] evidence: sec=${secLookup.status} coingecko=${coinGeckoData ? coinGeckoData.symbol : "none"} ` +
      `goplus=${goPlusData ? goPlusData.chainName : "n/a"} reports=${reportCount}`
  );

  return {
    query: parsed.query,
    slug,
    queryKind: parsed.kind,
    host: parsed.host || null,
    subject: parsed.subject,
    secData: secLookup,
    coinGeckoData,
    goPlusData,
    communityReports,
    additionalContext: additionalContext || "",
    // Internal hints, not sent to the model as instructions
    _hints: { hintsCrypto, marketDataUnavailable, isContract, curated, fileEntity, known },
  };
}

/* ------------------------------------------------------------------ *
 * Step 2 (fallback) -- deterministic rule-based scoring
 * ------------------------------------------------------------------ */

/**
 * The original weighted model. Used whenever the AI is unavailable, so a check
 * always returns something defensible.
 */
export function scoreWithRules(evidence) {
  const { secData: sec, coinGeckoData: token, goPlusData: contract, communityReports, queryKind, host } = evidence;
  const { hintsCrypto, marketDataUnavailable, isContract, curated } = evidence._hints;

  const redFlags = [];
  const greenFlags = [];
  const factors = {};
  let score = 0;

  const establishedToken = Boolean(token && token.marketCapRank && token.marketCapRank <= 500);
  const treatAsCrypto = hintsCrypto || Boolean(token);
  const reportCount = communityReports.count;

  /* --- Contract security (dominant on the 0x path) ---------------- */
  if (isContract) {
    if (contract) {
      const { points, flags, greenFlags: good } = scoreContract(contract);
      const honeypotPoints = contract.isHoneypot ? 6 : 0;
      const other = points - honeypotPoints;
      // Big centralised tokens legitimately hold these permissions (USDT can
      // freeze wallets), so they weigh far less on an established asset.
      factors.contract = Math.min(10, honeypotPoints + (establishedToken ? other * 0.35 : other));
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

  /* --- SEC status (heaviest weight) ------------------------------- */
  let status = sec.status;
  let statusLabel;
  let citation = "";

  if (status === "licensed") {
    statusLabel = sec.licenseType ? `Licensed by SEC Ghana as a ${sec.licenseType}` : "Licensed by SEC Ghana";
    citation = "Securities Industry Act, 2016 (Act 929)";
    greenFlags.push(`On the SEC Ghana licensed list${sec.licenseType ? ` as a ${sec.licenseType}` : ""}`);
    factors.status = 0;
  } else if (status === "sandbox") {
    statusLabel = "Provisional sandbox approval only — NOT a full SEC Ghana licence";
    citation = "Virtual Asset Service Providers Act, 2025 (Act 1154)";
    redFlags.push("Holds provisional sandbox approval only, not a full licence — protections are limited");
    greenFlags.push("Admitted to the SEC Ghana virtual asset sandbox");
    factors.status = 1.5;
  } else if (status === "blacklisted") {
    statusLabel = `Blacklisted — publicly warned against by ${sec.source || "SEC Ghana"}`;
    citation = "SEC Public Notice SEC/PN/002/07/2025; Section 109, Act 929";
    redFlags.push(blacklistFlagText(sec.source));
    factors.status = 5;
  } else if (status === "revoked") {
    statusLabel = "SEC Ghana licence revoked — no longer authorised";
    citation = "Securities Industry Act, 2016 (Act 929)";
    redFlags.push("SEC Ghana licence has been revoked");
    factors.status = 4.5;
  } else if (establishedToken || isContract) {
    statusLabel = "Crypto assets are not SEC Ghana licensed products — no licence expected";
    citation = "Virtual Asset Service Providers Act, 2025 (Act 1154)";
    redFlags.push("Not covered by SEC Ghana investor protection — you carry the full risk");
    factors.status = 1.5;
    status = "unregistered";
  } else {
    statusLabel = "Not on the SEC Ghana licensed list";
    citation = "Section 109, Securities Industry Act, 2016 (Act 929)";
    redFlags.push("Not licensed by SEC Ghana to take investments — unlicensed operation is illegal under Act 929");
    factors.status = 2.5;
    status = "unregistered";
  }
  score += factors.status;

  /* --- Age / track record ----------------------------------------- */
  const ageDays = token?.ageDays ?? null;

  if (status === "blacklisted" || status === "revoked") {
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
  } else if (establishedToken || status === "licensed" || status === "sandbox" || token || isContract) {
    factors.age = 0;
  } else {
    factors.age = 1;
    redFlags.push("No verifiable trading history or registration date");
  }
  score += factors.age;

  /* --- Promised returns / scam wording ---------------------------- */
  const haystack = [evidence.query, ...(sec.curatedRedFlags || [])].join(" ");
  const keywords = findScamKeywords(haystack);
  const returnPromise = /(\d{1,3})\s?%/.exec(haystack);

  if (keywords.length || returnPromise) {
    factors.returns = Math.min(1.5, 0.6 * keywords.length + (returnPromise ? 0.9 : 0));
    if (returnPromise) {
      redFlags.push(
        `Advertises returns of ${returnPromise[1]}% — SEC Ghana cites such rates as a fraud indicator`
      );
    }
    if (keywords.length) redFlags.push(`Uses classic scam wording: "${keywords.slice(0, 2).join('", "')}"`);
  } else {
    factors.returns = 0;
  }
  score += factors.returns;

  /* --- Community reports ------------------------------------------ */
  if (reportCount >= 5) factors.reports = 2;
  else if (reportCount >= 3) factors.reports = 1.5;
  else if (reportCount >= 1) factors.reports = 1;
  else factors.reports = 0;

  if (reportCount > 0) {
    redFlags.push(`${reportCount} community report${reportCount === 1 ? "" : "s"} from other Qwench users`);
  }
  score += factors.reports;

  /* --- Market presence / online footprint ------------------------- */
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
    redFlags.push("Live market data could not be checked just now — treat this result as incomplete");
  } else if (treatAsCrypto && !token && !isContract) {
    factors.presence += 1.5;
    redFlags.push("Token does not exist on CoinGecko — no real market data behind it");
  } else if (queryKind === "link") {
    const tld = secData.suspiciousTlds.find((t) => host.endsWith(t));
    if (tld) {
      factors.presence += 1;
      redFlags.push(`Website uses the ${tld} domain, common in throwaway scam sites`);
    }
    if (secData.linkShorteners.some((s) => host === s)) {
      factors.presence += 0.8;
      redFlags.push("Shared through a link shortener that hides the real destination");
    }
  } else if (status === "unregistered" && !curated && !isContract) {
    factors.presence += 0.8;
    redFlags.push("Faceless operation — no verifiable team, office address or licence number found");
  }

  factors.presence = Math.min(2.5, factors.presence);
  score += factors.presence;

  /* --- Overrides and clamping ------------------------------------- */
  if (status === "licensed" && reportCount < 3) score = Math.min(score, 2.5);
  if (status === "sandbox" && reportCount < 3) score = Math.min(score, 5);
  if (status === "blacklisted") score = Math.max(score, 8);
  if (status === "revoked") score = Math.max(score, 7);
  if (contract?.isHoneypot) score = Math.max(score, 9.5);

  score = Math.max(0.5, Math.min(10, Number(score.toFixed(1))));
  const { riskVerdict, riskColor } = verdictForScore(score);

  /* --- Flags -------------------------------------------------------*/
  const curatedFlags = sec.curatedRedFlags || [];
  const generic = !curatedFlags.length && status === "blacklisted" ? genericBlacklistFlags(sec.category, sec.source) : [];
  const scored = generic.length ? redFlags.filter((f) => f !== blacklistFlagText(sec.source)) : redFlags;
  const finalFlags = dedupe([...curatedFlags, ...generic, ...scored]).slice(0, 6);

  const name = sec.name || contract?.tokenName || token?.name || titleCase(evidence.subject);

  return {
    entityName: name,
    riskScore: score,
    riskVerdict,
    riskColor,
    summary: summaryFor({ name, status, riskVerdict, reportCount }),
    secStatus: { status, detail: statusLabel, citation },
    redFlags: finalFlags.map((f) => ({ flag: f, severity: severityFor(status, f), source: "Qwench rule engine" })),
    positiveSignals: dedupe(greenFlags)
      .slice(0, 4)
      .map((s) => ({ signal: s, source: "Qwench rule engine" })),
    recommendation: recommendationFor({
      verdict: riskVerdict,
      name,
      status,
      isCrypto: treatAsCrypto,
      honeypot: contract?.isHoneypot,
    }),
    scoreBreakdown: {
      licensing: Number(((factors.status / 5) * 40).toFixed(1)),
      returnFlags: Number(((factors.returns / 1.5) * 25).toFixed(1)),
      transparency: Number(((factors.presence / 2.5) * 20).toFixed(1)),
      digitalAsset: Number((((factors.contract || 0) / 10) * 15).toFixed(1)),
      communityBoost: Number(factors.reports.toFixed(1)),
    },
    disclaimer:
      "This assessment is based on publicly available data and SEC Ghana regulatory information. Always verify directly with SEC Ghana (0800100065) before making investment decisions.",
    _factors: factors,
  };
}

/* ------------------------------------------------------------------ *
 * Step 3 -- orchestrate: gather, let the AI decide, fall back to rules
 * ------------------------------------------------------------------ */

export async function runRiskCheck(rawQuery, { additionalContext = "", callProvider } = {}) {
  const evidence = await gatherEvidence(rawQuery, additionalContext);

  // Always compute the rule-based result: it is the fallback, and its factor
  // breakdown is useful for debugging even when the AI answers.
  const rules = scoreWithRules(evidence);

  // The model never sees our internal hints.
  const { _hints, ...aiInput } = evidence;
  const ai = await analyzeWithAI({ ...aiInput, slug: evidence.slug }, { callProvider });

  const chosen = ai || rules;
  const analyzedBy = ai ? "ai" : "rules";

  const result = normalize({ chosen, rules, evidence, analyzedBy, ai });

  console.log(
    `[risk] "${evidence.query}" -> ${result.riskScore}/10 ${result.riskVerdict} ` +
      `(by ${analyzedBy}${ai?.fromCache ? ", cached" : ""}, status: ${result.status}, reports: ${result.reportCount})`
  );

  await cacheEntity(result, evidence);
  return result;
}

/** Shapes either source into the single contract the API and bot consume. */
function normalize({ chosen, rules, evidence, analyzedBy, ai }) {
  const sec = chosen.secStatus || {};
  const status = sec.status || evidence.secData.status;
  const color = chosen.riskColor || "yellow";

  return {
    name: chosen.entityName || rules.entityName,
    query: evidence.query,
    slug: evidence.slug,
    queryKind: evidence.queryKind,
    category: evidence.secData.category || (evidence.coinGeckoData ? "crypto" : "other"),

    riskScore: chosen.riskScore,
    riskVerdict: chosen.riskVerdict,
    riskColor: color,
    riskLevel: LEVEL_TEXT[chosen.riskVerdict] || "MEDIUM RISK",
    emoji: EMOJI[color] || "🟡",
    summary: chosen.summary || rules.summary,

    status,
    statusLabel: sec.detail || rules.secStatus.detail,
    citation: sec.citation || rules.secStatus.citation,
    source: evidence.secData.source || "",
    licenseType: evidence.secData.licenseType || "",
    dateAdded: evidence.secData.dateAdded || null,

    // Plain strings for simple formatting, plus the structured version.
    redFlags: (chosen.redFlags || []).map((f) => f.flag),
    redFlagsDetailed: chosen.redFlags || [],
    greenFlags: (chosen.positiveSignals || []).map((s) => s.signal),
    positiveSignals: chosen.positiveSignals || [],

    recommendation: chosen.recommendation || rules.recommendation,
    scoreBreakdown: chosen.scoreBreakdown || rules.scoreBreakdown,

    reportCount: evidence.communityReports.count,
    coingecko: evidence.coinGeckoData,
    contract: evidence.goPlusData,

    analyzedBy,
    aiProvider: ai?.provider || null,
    aiModel: ai?.model || null,
    aiFromCache: Boolean(ai?.fromCache),
    aiCorrections: ai?.corrections || [],
    // The deterministic score is always reported alongside, so a surprising AI
    // verdict can be compared against the rules.
    ruleBasedScore: rules.riskScore,
    factors: rules._factors,

    checkedAt: new Date().toISOString(),
    disclaimer: chosen.disclaimer || rules.disclaimer,
  };
}

/** Keep a record so repeat lookups are fast and the web app has history. */
async function cacheEntity(result, evidence) {
  if (evidence.secData.found) {
    await Investment.updateOne({ slug: slugify(evidence.secData.name) }, { $set: { lastChecked: new Date() } }).catch(
      () => {}
    );
    return;
  }

  const storeSlug = slugify(result.name) || result.slug;
  await Investment.updateOne(
    { slug: storeSlug },
    {
      $addToSet: { aliases: result.slug },
      $set: {
        name: result.name,
        slug: storeSlug,
        category: result.category,
        status: "unknown",
        source: "Qwench risk engine",
        riskScore: result.riskScore,
        // Derived flags are deliberately not stored: they go stale.
        lastChecked: new Date(),
      },
    },
    { upsert: true }
  ).catch((err) => console.warn(`[risk] could not cache entity: ${err.message}`));
}

/* ------------------------------------------------------------------ *
 * Copy helpers
 * ------------------------------------------------------------------ */

function summaryFor({ name, status, riskVerdict, reportCount }) {
  if (status === "blacklisted") return `${name} is on a SEC Ghana public warning list and is not licensed to take your money.`;
  if (status === "revoked") return `${name} no longer holds a valid SEC Ghana licence.`;
  if (status === "licensed") return `${name} is licensed by SEC Ghana and shows no community complaints.`;
  if (status === "sandbox") return `${name} has provisional sandbox approval only, which is not a full licence.`;
  if (riskVerdict === "LOW") return `${name} looks legitimate, but it is not covered by SEC Ghana investor protection.`;
  if (reportCount > 0) return `${name} is unregistered with SEC Ghana and has ${reportCount} community report(s).`;
  return `${name} could not be verified against any SEC Ghana list.`;
}

function severityFor(status, flag) {
  if (/honeypot/i.test(flag)) return "critical";
  if (status === "blacklisted" || status === "revoked") return "critical";
  if (/not licensed|unlicensed|no legal protection|owner can change/i.test(flag)) return "high";
  if (/community report|market cap|volume|faceless|no website/i.test(flag)) return "medium";
  return "low";
}

function recommendationFor({ verdict, name, status, isCrypto, honeypot }) {
  if (honeypot) {
    return `Do not buy this token. The contract is built so you can buy but cannot sell — your money would be unrecoverable.`;
  }
  if (status === "blacklisted") {
    return `Do not put any money into ${name}. SEC Ghana has publicly warned against it and it has no licence to take deposits or investments. If you have already paid, stop sending money and report it on 0800100065.`;
  }
  if (status === "revoked") {
    return `${name} no longer holds a valid SEC Ghana licence. Do not place new money with them, and get advice on recovering anything already committed.`;
  }
  if (status === "sandbox") {
    return `${name} is in the SEC Ghana sandbox, which means provisional approval only — not a full licence. Keep any amount small and understand you have limited protection if it fails.`;
  }
  if (verdict === "LOW" && isCrypto) {
    return `${name} is a real, widely traded asset — but crypto prices swing hard and nobody in Ghana insures your loss. Use a reputable exchange, never an individual promising fixed returns.`;
  }
  if (verdict === "LOW") {
    return `${name} appears on the SEC Ghana licensed list. Still confirm the licence yourself at sec.gov.gh or on 0800100065, and never pay into a personal mobile money wallet.`;
  }
  if (verdict === "MEDIUM" && isCrypto) {
    return `${name} is tradeable but carries real risk — check the specific warnings above before you buy, and never invest money you cannot afford to lose.`;
  }
  if (verdict === "MEDIUM") {
    return `We could not verify ${name} against any SEC Ghana list. Ask for their SEC licence number and confirm it at sec.gov.gh before you pay anything. Operating without a licence is illegal under Act 929.`;
  }
  return `We strongly advise against investing in ${name}. It is not licensed by SEC Ghana and shows several of the fraud indicators SEC Ghana warns about.`;
}

function blacklistFlagText(source) {
  return `Named in a ${source || "SEC Ghana"} public warning as unlicensed`;
}

function genericBlacklistFlags(category, source) {
  const by = source || "SEC Ghana";
  const flags = [
    "Operating without a valid SEC Ghana licence (Section 109, Act 929)",
    `${by} has published a public warning telling people not to invest`,
  ];

  if (category === "forex") flags.push("Unlicensed forex / binary trading platform marketed to Ghanaians");
  else if (category === "crypto") flags.push("Unlicensed crypto scheme — no regulator can recover your money");
  else if (category === "ponzi") flags.push("Pays earlier members from new members' deposits, which always collapses");
  else flags.push("Any promise of guaranteed returns from this entity is unlawful in Ghana");

  flags.push("You would have no legal protection if your money disappears");
  return flags;
}

/* ------------------------------------------------------------------ */

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
