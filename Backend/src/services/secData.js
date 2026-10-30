import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = join(here, "..", "data", "sec-ghana.json");

const raw = JSON.parse(readFileSync(dataPath, "utf8"));

console.log(
  `[sec-data] loaded ${(raw.authorities || []).length} authorities, ${raw.licensed.length} licensed, ${(raw.sandbox || []).length} sandbox and ${raw.blacklisted.length} blacklisted entities`
);

/** "Menzgold Ghana Ltd!" -> "menzgold ghana ltd" */
export function slugify(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Strip boilerplate company words so "Menzgold Ghana Limited" matches "menzgold".
// Legal form, geography and generic structure only. Business-activity words
// ("investment", "trading", "platform") are deliberately NOT stripped: they
// distinguish one name from another, and folding them away let "Vaulta
// Investment" resolve to the sandbox entity "Vaulta" and inherit its standing.
const SUFFIXES =
  /\b(ltd|limited|plc|inc|llc|company|co|ghana|gh|group|holdings|services|service|enterprise|enterprises)\b/g;

function core(text = "") {
  return slugify(text).replace(SUFFIXES, " ").replace(/\s+/g, " ").trim();
}

/** Normalised entries, each tagged with its status. */
export const blacklistedEntities = raw.blacklisted.map((e) => ({
  ...e,
  status: "blacklisted",
  aliases: e.aliases || [],
  redFlags: e.redFlags || [],
  category: e.category || "other",
}));

export const licensedEntities = raw.licensed.map((e) => ({
  ...e,
  status: "licensed",
  aliases: e.aliases || [],
  redFlags: [],
  category: "investment",
}));

/** Regulators and government bodies -- never risk-scored as investments. */
export const authorityEntities = (raw.authorities || []).map((e) => ({
  ...e,
  status: "authority",
  aliases: e.aliases || [],
  redFlags: [],
  category: "other",
  source: "Government of Ghana",
}));

/** Any Ghanaian government domain belongs to an authority, listed or not. */
export function isGovernmentDomain(host = "") {
  const h = String(host).toLowerCase().replace(/^www\./, "");
  return /\.gov\.gh$/.test(h) || /\.gov$/.test(h) || h === "gse.com.gh" || h === "nicgh.org";
}

/** Find an authority by its registered website. */
export function lookupAuthorityByDomain(host = "") {
  const h = String(host).toLowerCase().replace(/^www\./, "");
  return authorityEntities.find((a) => a.website === h || a.aliases.includes(h)) || null;
}

/** Provisional approval under the Act 1154 sandbox -- not a full licence. */
export const sandboxEntities = (raw.sandbox || []).map((e) => ({
  ...e,
  status: "sandbox",
  aliases: e.aliases || [],
  redFlags: [],
  category: "crypto",
  source: "SEC Ghana virtual asset sandbox (Act 1154)",
}));

function buildIndex() {
  const index = new Map();

  const add = (key, entry) => {
    const k = core(key);
    // Keep the first entry that claims a key, but never let a short generic
    // alias overwrite a more specific one.
    if (k && k.length >= 3 && !index.has(k)) index.set(k, entry);
  };

  // Authorities are indexed first and win every collision: a regulator must
  // never be shadowed by a scheme whose name happens to resemble it.
  for (const e of authorityEntities) {
    add(e.name, e);
    e.aliases.forEach((a) => add(a, e));
  }

  // Blacklisted entries next: if a name appears on both lists, the warning wins.
  for (const e of blacklistedEntities) {
    add(e.name, e);
    e.aliases.forEach((a) => add(a, e));
  }

  for (const e of licensedEntities) {
    add(e.name, e);
    e.aliases.forEach((a) => add(a, e));
  }

  for (const e of sandboxEntities) {
    add(e.name, e);
    e.aliases.forEach((a) => add(a, e));
  }

  return index;
}

const index = buildIndex();

/**
 * Look a query up against the SEC Ghana lists.
 * Exact-ish match first, then a loose containment match so
 * "is menzgold legit" still resolves.
 */
export function lookupSecEntity(query) {
  const key = core(query);
  if (!key) return null;

  if (index.has(key)) return index.get(key);

  // Loose match in ONE direction only: a registered name appearing inside what
  // the user typed, as whole words. "is menzgold legit" -> Menzgold.
  //
  // The reverse direction is deliberately not supported. Matching a short query
  // as a fragment of a longer registered name is nearly always coincidence, and
  // it was actively harmful: "SEC Ghana" matched inside "GAIP Securities ..."
  // and "Ghana Stock Exchange" inside "Quant Vest Stock Exchange", flagging
  // both as blacklisted. Short forms belong in each entity's aliases instead.
  const keyWords = key.split(" ");

  for (const [k, entry] of index) {
    if (k.length < 5) continue;

    const kWords = k.split(" ");
    if (!containsWords(keyWords, kWords)) continue;

    const extras = keyWords.filter((w) => !kWords.includes(w));
    if (extras.every((w) => QUERY_NOISE.has(w))) return entry;

    // The query carries real extra words, so it names something else:
    // "Black Star Energy" is not "Black Star Advisors". Granting a look-alike
    // the licensed entity's standing is the worst mistake this tool can make,
    // so a loose match may only ever carry a WARNING forward, never a clean
    // bill of health. "Menzgold Premium" still resolves to Menzgold.
    if (entry.status === "blacklisted" || entry.status === "revoked") return entry;
  }

  return null;
}

// Filler people wrap around a company name when asking about it. Extra words
// drawn only from this list mean they are still naming the same company.
const QUERY_NOISE = new Set([
  "is", "are", "was", "the", "a", "an", "this", "that", "it", "they",
  "about", "legit", "legitimate", "safe", "good", "bad", "real", "fake",
  "scam", "scammer", "fraud", "check", "verify", "please", "should", "i",
  "my", "me", "we", "you", "money", "cash", "with", "in", "on", "to", "for",
  "of", "and", "or", "from", "any", "info", "information", "tell", "know",
  "think", "what", "do", "does", "can", "will", "put", "join", "joined",
]);

/** Does `words` contain `seq` as a consecutive run of whole words? */
function containsWords(words, seq) {
  if (!seq.length || seq.length > words.length) return false;
  for (let i = 0; i <= words.length - seq.length; i++) {
    if (seq.every((w, j) => words[i + j] === w)) return true;
  }
  return false;
}

export function findScamKeywords(text = "") {
  const lower = String(text).toLowerCase();
  return raw.scamKeywords.filter((kw) => lower.includes(kw));
}

export const secData = raw;
