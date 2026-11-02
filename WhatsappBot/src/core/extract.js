/**
 * Works out how to put a message to the API — not what it means.
 *
 * Entity resolution belongs to the evidence engine. The bot only decides
 * whether the user typed a number, a wallet, a link or a name, so the right
 * fields go up. Anything it is not sure about is sent as free text for the
 * backend to interpret, which keeps the two from ever disagreeing.
 */

const URL_RE = /\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+/gi;
// A bare domain with no scheme, e.g. "expertoptiongh.com" or "sec.gov.gh".
const BARE_DOMAIN_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const GH_PHONE_RE = /(?:\+?233|0)\s?(?:2\d|5\d)\s?\d{3}\s?\d{4}/;
const EVM_WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const TRON_WALLET_RE = /^T[A-Za-z1-9]{33}$/;
const BTC_WALLET_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const SOCIAL_RE = /(?:tiktok\.com|t\.me|telegram\.me|instagram\.com|facebook\.com)\/[^\s]+/i;

/** Strip the question people wrap a name in: "is X legit?" -> "X". */
export function cleanName(text) {
  return String(text || "")
    .replace(/^(is|are|do you know|what about|check|verify|have you heard of|tell me about|pls|please)\s+/i, "")
    .replace(/\s*(legit|legitimate|safe|real|genuine|scam|fraud|ponzi|or not)\s*\??$/i, "")
    .replace(/[?!.]+$/, "")
    .trim();
}

export function findUrls(text) {
  return [...String(text || "").matchAll(URL_RE)].map((m) => m[0]);
}

/**
 * Returns the fields to send to /v1/public/check.
 *
 * `text` is always included so the backend sees exactly what the person wrote;
 * `recipient`/`type` are added only when the shape is unmistakable.
 */
export function extractQuery(messageText) {
  const text = String(messageText || "").trim();
  if (!text) return null;

  const urls = findUrls(text);
  const social = text.match(SOCIAL_RE);

  // A social link names a profile, not a company, so it goes up as a link for
  // the backend to pull the handle out of.
  if (social) return { text, urls: urls.length ? urls : [social[0]] };
  if (urls.length) return { text, urls };

  const bare = text.split(/\s+/).find((word) => BARE_DOMAIN_RE.test(word) && word.includes("."));
  if (bare && text.split(/\s+/).length === 1) {
    return { text, recipient: bare, type: "domain" };
  }

  const phone = text.match(GH_PHONE_RE);
  if (phone) return { text, recipient: phone[0].replace(/\s/g, ""), type: "momo_number" };

  const word = text.split(/\s+/)[0];
  if (EVM_WALLET_RE.test(word) || TRON_WALLET_RE.test(word) || BTC_WALLET_RE.test(word)) {
    return { text, recipient: word, type: "wallet" };
  }

  const name = cleanName(text);
  return name ? { text: name } : { text };
}

/** Commands the bot handles itself, before anything is sent to the API. */
export function readCommand(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return null;
  if (/^(report|rep)$/.test(t)) return "report";
  if (/^(yes|y)$/.test(t)) return "yes";
  if (/^(no|n)$/.test(t)) return "no";
  if (/^(cancel|stop|quit)$/.test(t)) return "cancel";
  if (/^(help|info|start|menu|hi|hello|hey)$/.test(t)) return "help";
  return null;
}
