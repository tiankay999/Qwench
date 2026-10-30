import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = join(here, "..", "data", "sec-ghana.json");

const raw = JSON.parse(readFileSync(dataPath, "utf8"));

console.log(
  `[sec-data] loaded ${raw.licensed.length} licensed, ${(raw.sandbox || []).length} sandbox and ${raw.blacklisted.length} blacklisted entities`
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
const SUFFIXES =
  /\b(ltd|limited|plc|inc|llc|company|co|ghana|gh|group|holdings|services|service|enterprise|enterprises|investment|investments|invest|platform|trading|trade)\b/g;

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

  // Blacklisted entries are indexed first: if a name appears on both lists, the
  // warning must win.
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

  for (const [k, entry] of index) {
    if (k.length >= 4 && (key.includes(k) || k.includes(key))) return entry;
  }

  return null;
}

export function findScamKeywords(text = "") {
  const lower = String(text).toLowerCase();
  return raw.scamKeywords.filter((kw) => lower.includes(kw));
}

export const secData = raw;
