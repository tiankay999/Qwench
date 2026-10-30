import Fuse from "fuse.js";

import Investment from "../models/Investment.js";

/**
 * Name verification / anti-spoofing layer.
 *
 * Runs BEFORE the risk analysis. Two jobs, pulling in opposite directions:
 *   1. catch names built to look like a real entity ("Vaultaa", "Menzg0ld")
 *   2. do NOT scare someone off a legitimate company because they typed its
 *      informal name ("Databank Ghana Ltd")
 *
 * So added words are classified: plain corporate suffixes are benign, while
 * authority/marketing words are the actual spoofing signal.
 */

const fuseOptions = {
  includeScore: true,
  threshold: 0.4,
  keys: ["name", "aliases"],
  minMatchCharLength: 3,
};

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeBasic(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fold characters chosen to look like letters: V4ulta -> vaulta, Menzg0ld -> menzgold. */
export function normalizeHomoglyphs(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/1/g, "l")
    .replace(/0/g, "o")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/8/g, "b")
    .replace(/\$/g, "s")
    .replace(/@/g, "a")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/[_\-.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "vaultaa" -> "vaulta", so duplicated letters stop hiding a known name. */
export function collapseRepeats(str) {
  return normalizeBasic(str).replace(/(.)\1+/g, "$1");
}

/** Comparison key: homoglyphs folded, repeats collapsed, spaces removed. */
function tightKey(str) {
  return collapseRepeats(normalizeHomoglyphs(str)).replace(/\s/g, "");
}

/* ------------------------------------------------------------------ *
 * Added-word classification
 * ------------------------------------------------------------------ */

// Ordinary company-name furniture. Someone typing these is almost certainly
// naming the real company, so these alone never trigger a spoofing alert.
const BENIGN_WORDS = new Set([
  "ltd", "limited", "plc", "inc", "llc", "co", "company", "corp", "corporation",
  "ghana", "gh", "services", "service", "financial", "finance",
]);

// Words a spoof adds to borrow authority or imply a better product. SEC Ghana's
// own notice calls out "Premium", "Official" and "GH" style additions.
const AUTHORITY_WORDS = new Set([
  "official", "premium", "pro", "plus", "vip", "elite", "global", "international",
  "verified", "certified", "licensed", "registered", "approved", "sec", "authorised",
  "authorized", "real", "original", "main", "new", "investment", "investments",
  "invest", "capital", "fund", "funds", "wealth", "trust", "holdings", "group",
  "exchange", "trading", "trade", "crypto", "token", "coin", "pay", "payment",
  "bonus", "rewards", "profit", "profits", "earn", "earning", "earnings",
]);

/**
 * Split added words three ways. The distinction matters: only a borrowed
 * authority word is real spoofing evidence. An unrecognised word usually means
 * a genuinely different business -- "Black Star Energy" is not impersonating
 * "Black Star Advisors" -- so those must not raise an impersonation alert.
 */
function classifyExtraWords(words) {
  const benign = [];
  const authority = [];
  const other = [];
  for (const w of words) {
    if (BENIGN_WORDS.has(w)) benign.push(w);
    else if (AUTHORITY_WORDS.has(w)) authority.push(w);
    else other.push(w);
  }
  return { benign, authority, other, allBenign: authority.length === 0 && other.length === 0 };
}

/* ------------------------------------------------------------------ *
 * Entity index
 * ------------------------------------------------------------------ */

let cache = null;
const INDEX_TTL_MS = 5 * 60 * 1000;

/** Call after the register is reloaded so the index picks up new entities. */
export function invalidateNameIndex() {
  cache = null;
  console.log("[verify] name index invalidated");
}

async function getIndex() {
  if (cache && Date.now() - cache.builtAt < INDEX_TTL_MS) return cache;

  // Only curated entries. Records the risk engine cached itself carry
  // status "unknown" -- they are arbitrary past user queries and must never
  // be matched against or named in an alert.
  const docs = await Investment.find(
    { status: { $in: ["licensed", "sandbox", "blacklisted", "revoked"] } },
    { name: 1, aliases: 1, status: 1, source: 1, licenseType: 1, category: 1, slug: 1 }
  ).lean();

  const entities = docs.map((d) => ({
    name: d.name,
    aliases: d.aliases || [],
    status: d.status,
    source: d.source || "",
    licenseType: d.licenseType || "",
    category: d.category || "other",
    slug: d.slug,
  }));

  // name + every alias, each as its own comparison key
  const keyed = [];
  for (const e of entities) {
    for (const label of [e.name, ...e.aliases]) {
      const basic = normalizeBasic(label);
      if (basic.length < 3) continue;
      keyed.push({ entity: e, label, basic, tight: tightKey(label), words: basic.split(" ") });
    }
  }

  cache = { builtAt: Date.now(), entities, keyed, fuse: new Fuse(entities, fuseOptions) };
  console.log(`[verify] name index built: ${entities.length} entities, ${keyed.length} searchable labels`);
  return cache;
}

/* ------------------------------------------------------------------ *
 * Variant detection
 * ------------------------------------------------------------------ */

/**
 * Is `query` a dressed-up version of a known label? Returns the strongest
 * match with the specific indicators that fired.
 */
function findVariant(query, keyed) {
  const qBasic = normalizeBasic(query);
  const qTight = tightKey(query);
  const qHomo = normalizeHomoglyphs(qBasic).replace(/\s/g, "");
  const qWords = qBasic.split(" ").filter(Boolean);

  let best = null;

  const consider = (candidate) => {
    if (!best || candidate.rank < best.rank) best = candidate;
  };

  for (const k of keyed) {
    if (k.basic === qBasic) return { exact: true, k, indicators: [] };

    const kHomoTight = normalizeHomoglyphs(k.basic).replace(/\s/g, "");
    const indicators = [];

    // Same string once look-alike characters are folded in.
    if (qHomo === kHomoTight && qBasic !== k.basic) {
      indicators.push("numbers or symbols substituted for letters");
      consider({ rank: 1, k, indicators: [...indicators] });
      continue;
    }

    // Same string once duplicated letters are collapsed.
    if (qTight === k.tight && qBasic !== k.basic) {
      if (collapseRepeats(qBasic) !== qBasic) indicators.push("letters duplicated to alter the spelling");
      else indicators.push("spelling altered from the registered name");
      consider({ rank: 1, k, indicators: [...indicators] });
      continue;
    }

    // Known label appears inside the query as whole words, plus extras.
    const containsAsWords = k.words.length && containsSequence(qWords, k.words);
    if (containsAsWords && qWords.length > k.words.length) {
      const extras = subtractSequence(qWords, k.words);
      const { benign, authority, other, allBenign } = classifyExtraWords(extras);

      if (authority.length) indicators.push(`added word${authority.length > 1 ? "s" : ""}: "${authority.join('", "')}"`);
      else if (other.length) indicators.push(`different wording: "${other.join('", "')}"`);
      else if (benign.length) indicators.push(`added "${benign.join('", "')}"`);

      // Only a borrowed authority word escalates to an impersonation alert.
      const escalate = authority.length > 0;
      consider({ rank: escalate ? 2 : 3, k, indicators: [...indicators], extras, allBenign, escalate });
      continue;
    }

    // Known label glued to extra characters with no space: "KoinkoinGH".
    if (!containsAsWords && qTight.length > k.tight.length && k.tight.length >= 4) {
      if (qTight.startsWith(k.tight) || qTight.endsWith(k.tight)) {
        const added = qTight.replace(k.tight, "");
        if (added.length <= 8) {
          indicators.push(`"${added}" appended to the registered name without a space`);
          consider({ rank: 2, k, indicators: [...indicators] });
        }
      }
    }
  }

  return best;
}

/** Does `words` contain `seq` as a consecutive run? */
function containsSequence(words, seq) {
  if (seq.length > words.length) return false;
  for (let i = 0; i <= words.length - seq.length; i++) {
    if (seq.every((w, j) => words[i + j] === w)) return true;
  }
  return false;
}

function subtractSequence(words, seq) {
  for (let i = 0; i <= words.length - seq.length; i++) {
    if (seq.every((w, j) => words[i + j] === w)) {
      return [...words.slice(0, i), ...words.slice(i + seq.length)];
    }
  }
  return words;
}

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

const STATUS_LABEL = {
  licensed: "SEC Ghana licensed entity",
  sandbox: "SEC Ghana Virtual Asset Sandbox participant",
  blacklisted: "SEC Ghana blacklisted entity",
  revoked: "entity whose SEC Ghana licence was revoked",
};

/**
 * Verify a searched name before any risk analysis runs.
 *
 * decision is one of:
 *   exact             - matches a registered name; go straight to analysis
 *   blacklist_variant - variant of a blacklisted name; auto-flag, no asking
 *   spoofing_alert    - close to a legitimate name but not it; ask the user
 *   soft_warning      - loosely similar; proceed, but mention it
 *   no_match          - nothing similar; normal analysis
 */
export async function verifyName(rawQuery) {
  const query = String(rawQuery || "").trim();
  const base = {
    query,
    normalized: normalizeBasic(query),
    decision: "no_match",
    match: null,
    fuseScore: null,
    similarity: null,
    spoofIndicators: [],
    needsConfirmation: false,
    autoFlagged: false,
    injectedFlags: [],
    spoofingDetection: null,
  };

  if (normalizeBasic(query).length < 3) return base;

  const { keyed, fuse } = await getIndex();

  /* --- Exact or structural variant --------------------------------- */
  const variant = findVariant(query, keyed);

  if (variant?.exact) {
    console.log(`[verify] "${query}" is an exact match for ${variant.k.entity.name} (${variant.k.entity.status})`);
    return { ...base, decision: "exact", match: entityOut(variant.k.entity), fuseScore: 0, similarity: 1 };
  }

  if (variant) {
    const entity = variant.k.entity;
    const similarity = Number((1 - levenshteinRatio(normalizeBasic(query), variant.k.basic)).toFixed(2));
    return decide({
      base,
      query,
      entity,
      indicators: variant.indicators,
      similarity,
      allBenign: variant.allBenign,
      escalate: variant.escalate !== false,
    });
  }

  /* --- Fuzzy search ------------------------------------------------ */
  const hits = fuse.search(normalizeBasic(query));
  const top = hits[0];

  if (!top) {
    console.log(`[verify] "${query}" -> no similar entity`);
    return base;
  }

  const score = Number(top.score.toFixed(3));
  const entity = top.item;
  const similarity = Number((1 - score).toFixed(2));

  // Fuse scores well on a single shared token, so "Gold Trust" looks like a
  // match for "Gold Coast Fund Management". Accusing someone of impersonation
  // on that basis is worse than missing a spoof, so require the whole name to
  // be genuinely close before escalating.
  const ratio = bestLabelRatio(normalizeBasic(query), entity);

  if (ratio > 0.45) {
    console.log(
      `[verify] "${query}" -> discarding weak match "${entity.name}" (fuse ${score}, edit ratio ${ratio.toFixed(2)})`
    );
    return { ...base, fuseScore: score };
  }

  if (ratio > 0.34) {
    console.log(`[verify] "${query}" -> soft warning, loosely like ${entity.name} (edit ratio ${ratio.toFixed(2)})`);
    return {
      ...base,
      decision: "soft_warning",
      match: entityOut(entity),
      fuseScore: score,
      similarity,
      spoofIndicators: [`loosely similar to "${entity.name}"`],
    };
  }

  if (score < 0.3) {
    return decide({
      base,
      query,
      entity,
      indicators: [`spelling is very close to "${entity.name}"`],
      similarity,
      fuseScore: score,
    });
  }

  if (score <= 0.5) {
    console.log(`[verify] "${query}" -> soft warning, similar to ${entity.name} (score ${score})`);
    return {
      ...base,
      decision: "soft_warning",
      match: entityOut(entity),
      fuseScore: score,
      similarity,
      spoofIndicators: [`loosely similar to "${entity.name}"`],
    };
  }

  console.log(`[verify] "${query}" -> no meaningful match (best score ${score})`);
  return { ...base, fuseScore: score };
}

function decide({ base, query, entity, indicators, similarity, fuseScore = null, allBenign = false, escalate = true }) {
  const match = entityOut(entity);
  const isBad = entity.status === "blacklisted" || entity.status === "revoked";

  // A variant of a blacklisted name is never a different company. Auto-flag it
  // rather than offering it as a choice.
  if (isBad) {
    console.log(`[verify] 🔴 "${query}" is a variant of blacklisted "${entity.name}" -- auto-flagging`);
    return {
      ...base,
      decision: "blacklist_variant",
      match,
      fuseScore,
      similarity,
      spoofIndicators: indicators,
      autoFlagged: true,
      injectedFlags: [
        {
          flag: `"${query}" is a name variant of SEC Ghana-blacklisted entity "${entity.name}" — adding or changing words does not make it a different company`,
          severity: "critical",
          source: "Qwench name verification",
        },
      ],
      spoofingDetection: spoofPayload({ query, entity, indicators, similarity, userChoice: null }),
    };
  }

  // Either only ordinary corporate suffixes were added, or the extra words
  // point to a different business rather than borrowed authority. Mention it,
  // but do not accuse anyone of impersonation.
  if (allBenign || !escalate) {
    console.log(`[verify] "${query}" -> soft warning (benign suffix on ${entity.name})`);
    return { ...base, decision: "soft_warning", match, fuseScore, similarity, spoofIndicators: indicators };
  }

  console.log(`[verify] ⚠️  "${query}" resembles ${entity.status} entity "${entity.name}" -- asking the user`);
  return {
    ...base,
    decision: "spoofing_alert",
    match,
    fuseScore,
    similarity,
    spoofIndicators: indicators,
    needsConfirmation: true,
    injectedFlags: [
      {
        flag: `Name closely resembles ${entity.status} entity "${entity.name}" — possible impersonation`,
        severity: "high",
        source: "Qwench name verification",
      },
    ],
    spoofingDetection: spoofPayload({ query, entity, indicators, similarity, userChoice: null }),
  };
}

function spoofPayload({ query, entity, indicators, similarity, userChoice }) {
  return {
    isSuspectedSpoof: true,
    originalQuery: query,
    similarTo: entity.name,
    similarityScore: similarity,
    matchedEntityStatus: entity.status,
    spoofIndicators: indicators,
    userChoice,
  };
}

function entityOut(e) {
  return {
    name: e.name,
    status: e.status,
    statusLabel: STATUS_LABEL[e.status] || e.status,
    source: e.source,
    licenseType: e.licenseType,
    category: e.category,
    slug: e.slug,
  };
}

/* ------------------------------------------------------------------ */

/** Closest edit-distance ratio between the query and any of an entity's labels. */
function bestLabelRatio(query, entity) {
  let best = 1;
  for (const label of [entity.name, ...(entity.aliases || [])]) {
    const r = levenshteinRatio(query, normalizeBasic(label));
    if (r < best) best = r;
  }
  return best;
}

/** Normalised edit distance, 0 = identical. Used only to report similarity. */
function levenshteinRatio(a, b) {
  if (!a.length && !b.length) return 0;
  const d = levenshtein(a, b);
  return d / Math.max(a.length, b.length);
}

function levenshtein(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}
