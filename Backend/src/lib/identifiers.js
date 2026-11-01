import crypto from "node:crypto";

/**
 * Normalisation and keyed hashing for every identifier Qwench matches on.
 *
 * Identifiers are normalised to a canonical form, then hashed with HMAC-SHA256
 * under a server-side key, so a stored hash can be matched against a future lookup
 * but cannot be reversed. See models/Identifier.js for which readable values are kept.
 */

export const IDENTIFIER_TYPES = [
  "name",
  "domain",
  "momo_number",
  "bank_account",
  "wallet",
  "social_handle",
  "telegram_link",
  "tiktok_handle",
  "merchant_id",
];

/** Types that hold personal data and must never be displayed raw. */
export const SENSITIVE_TYPES = new Set(["momo_number", "bank_account"]);

/** Types where a near-miss is still a useful match. Numbers never qualify. */
export const FUZZY_ELIGIBLE_TYPES = new Set(["name", "social_handle", "tiktok_handle"]);

/**
 * Real businesses whose names collide with entities named in SEC notices.
 * Fuzzy matching on these would put a legitimate global brand into a Ghanaian
 * scam warning, so they are matched exactly or not at all.
 */
export const EXACT_MATCH_ONLY = new Set(["dallmayr", "daraz", "hut 8", "hut8"]);

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

const GH_COUNTRY_CODE = "233";

/** Ghanaian numbers to +233XXXXXXXXX, spaces and dashes stripped. */
export function normalizePhone(raw) {
  let digits = String(raw || "").replace(/[^\d+]/g, "");
  if (!digits) return "";

  digits = digits.replace(/^\+/, "");
  // 00233... international prefix
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Local 0XXXXXXXXX -> 233XXXXXXXXX
  if (digits.startsWith("0")) digits = GH_COUNTRY_CODE + digits.slice(1);
  // Bare 9-digit local number
  if (digits.length === 9 && !digits.startsWith(GH_COUNTRY_CODE)) digits = GH_COUNTRY_CODE + digits;

  return `+${digits}`;
}

/** Lowercase, drop scheme, www. and any trailing slash or path noise. */
export function normalizeDomain(raw) {
  let host = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^www\./, "");

  host = host.split("/")[0].split("?")[0].split("#")[0].split("@").pop();
  return host.replace(/\.+$/, "").replace(/:\d+$/, "");
}

/** EVM addresses are case-insensitive; keep other chains as given but trimmed. */
export function normalizeWallet(raw) {
  const value = String(raw || "").trim();
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? value.toLowerCase() : value;
}

/** Lowercase, trim, collapse runs of whitespace. */
export function normalizeName(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeHandle(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
}

/** Digits only — formatting varies by bank and carries no meaning. */
export function normalizeAccount(raw) {
  return String(raw || "").replace(/\D/g, "");
}

/** Dispatch on identifier type. Unknown types fall back to name rules. */
export function normalizeIdentifier(type, raw) {
  switch (type) {
    case "momo_number":
      return normalizePhone(raw);
    case "bank_account":
      return normalizeAccount(raw);
    case "domain":
      return normalizeDomain(raw);
    case "wallet":
      return normalizeWallet(raw);
    case "social_handle":
    case "tiktok_handle":
      return normalizeHandle(raw);
    case "telegram_link":
      return normalizeDomain(raw) + (String(raw).match(/\/([A-Za-z0-9_]+)\/?$/)?.[1]?.toLowerCase() ?? "");
    case "merchant_id":
      return String(raw || "").trim().toUpperCase();
    case "name":
    default:
      return normalizeName(raw);
  }
}

/* ------------------------------------------------------------------ *
 * Keyed hashing
 * ------------------------------------------------------------------ */

function keyFor(purpose) {
  const key = purpose === "phone" ? process.env.PHONE_HASH_SALT : process.env.HMAC_SECRET_KEY;
  if (!key || !key.trim()) {
    throw new Error(
      `${purpose === "phone" ? "PHONE_HASH_SALT" : "HMAC_SECRET_KEY"} is not set — refusing to hash with an empty key`
    );
  }
  return key;
}

/**
 * HMAC-SHA256 of a normalised identifier, under HMAC_SECRET_KEY. The type is
 * mixed into the message so the same digits as a MoMo number and a bank account
 * do not collide.
 */
export function hashIdentifier(type, normalized) {
  if (!normalized) return "";
  return crypto.createHmac("sha256", keyFor("shared")).update(`${type}:${normalized}`).digest("hex");
}

/** Normalise and hash in one step. */
export function buildIdentifier(type, raw, extra = {}) {
  const normalized = normalizeIdentifier(type, raw);
  const canFuzzy =
    FUZZY_ELIGIBLE_TYPES.has(type) && !EXACT_MATCH_ONLY.has(normalizeName(normalized));

  return {
    type,
    raw: SENSITIVE_TYPES.has(type) ? "" : String(raw || "").trim(),
    normalized,
    valueHash: hashIdentifier(type, normalized),
    allowFuzzy: canFuzzy,
    ...extra,
  };
}

/**
 * Sender hashes use PHONE_HASH_SALT and rotate daily, so a number cannot be
 * tracked across days. They are only used for the fair-use limit in SenderDay.
 */
export function hashSender(rawSender, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  const normalized = normalizePhone(rawSender);
  if (!normalized) return "";
  return crypto.createHmac("sha256", keyFor("phone")).update(`sender:${day}:${normalized}`).digest("hex");
}

/** "2026-11-01T14" — the aggregation bucket used by Check and Signal. */
export function hourBucket(date = new Date()) {
  return date.toISOString().slice(0, 13);
}

/* ------------------------------------------------------------------ *
 * Reversible encryption, for the one field that needs it
 * ------------------------------------------------------------------ */

/**
 * An appeal has to be answerable, so the contact is encrypted rather than
 * hashed, and deleted once the appeal closes.
 */
export function encryptContact(plain) {
  if (!plain) return "";
  const key = crypto.createHash("sha256").update(keyFor("shared")).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${enc.toString("base64")}`;
}

export function decryptContact(payload) {
  if (!payload) return "";
  const [ivB64, tagB64, dataB64] = String(payload).split(".");
  if (!ivB64 || !tagB64 || !dataB64) return "";

  const key = crypto.createHash("sha256").update(keyFor("shared")).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

/** "Menzgold Ghana Ltd" -> "menzgold-ghana-ltd" */
export function slugifyEntity(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
