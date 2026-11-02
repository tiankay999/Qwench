import { normalizeDomain, normalizePhone, normalizeWallet } from "../lib/identifiers.js";

/**
 * Pulls what can be checked out of a message, using rules only. Pure functions.
 *
 * Names aren't guessed here: a capitalised word is not a company. Names come from
 * matching the message against known entities, or from AI candidates that
 * literally appear in the message.
 */

const PHONE = /(?<![\d+])(?:\+?233|0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}(?!\d)/g;
const WALLET = /\b0x[a-fA-F0-9]{40}\b/g;
const URL = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi;
// Bare domains only on known endings, so "works.Great" in a sentence isn't one.
const BARE_DOMAIN = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|gh|info|biz|xyz|tk|ml|ga|cf|gq|top|online|site|club|app|me)\b(?:\/[^\s<>"')]*)?/gi;

// Fetched by a person only, never automatically.
const MANUAL_REVIEW_HOSTS = /^(?:[a-z0-9-]+\.)?(?:t\.me|telegram\.me|telegram\.org|tiktok\.com)$/;

const unique = (items) => [...new Set(items)];
const trimPunctuation = (s) => s.replace(/[.,;:!?]+$/, "");

function linksIn(text) {
  const urls = (text.match(URL) || []).map(trimPunctuation);
  const withoutUrls = text.replace(URL, " ");
  const bare = (withoutUrls.match(BARE_DOMAIN) || []).map(trimPunctuation);
  return [...urls, ...bare];
}

/** Host and path of a social link, without protocol or www. */
function socialLink(link) {
  return link.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("?")[0].replace(/\/$/, "").toLowerCase();
}

export function extract(text) {
  const input = String(text || "");
  const domains = [];
  const manualReview = [];

  for (const link of linksIn(input.replace(WALLET, " "))) {
    const host = normalizeDomain(link);
    if (MANUAL_REVIEW_HOSTS.test(host)) manualReview.push(socialLink(link));
    else if (host) domains.push(host);
  }

  return {
    names: [],
    domains: unique(domains),
    numbers: unique((input.match(PHONE) || []).map(normalizePhone).filter((n) => /^\+233\d{9}$/.test(n))),
    wallets: unique((input.match(WALLET) || []).map(normalizeWallet)),
    manual_review: unique(manualReview),
  };
}

/** AI can add candidates, but each one must literally appear in the message. */
export function mergeAiCandidates(rules, ai, text) {
  if (!ai || ai.error) return rules;

  const haystack = String(text || "").toLowerCase();
  const grounded = (items) => (items || []).map((v) => String(v).trim()).filter((v) => v && haystack.includes(v.toLowerCase()));

  return {
    ...rules,
    names: unique([...rules.names, ...grounded(ai.entities_mentioned)]),
    numbers: unique([...rules.numbers, ...grounded(ai.numbers_found).map(normalizePhone).filter((n) => /^\+233\d{9}$/.test(n))]),
    domains: unique([...rules.domains, ...grounded(ai.domains_found).map(normalizeDomain).filter(Boolean)]),
    wallets: unique([...rules.wallets, ...grounded(ai.wallets_found).map(normalizeWallet)]),
  };
}

const SIGNS = [
  [/\bguarantee[ds]?\b|\bassured\b/i, "The message promises guaranteed returns."],
  [/\brisk[- ]?free\b|\bno risk\b|\b100% safe\b/i, "The message says there is no risk."],
  [/\bdouble your\b|\bdoubler\b/i, "The message says your money will double."],
  [/\brefer(?:ral)?\b|\brecruit\b|\bdownline\b|\binvite \d+\b/i, "The message asks you to bring in other people."],
  [/\bonly today\b|\blast chance\b|\bact now\b|\bhurry\b|\burgent\b|\blimited slots?\b/i, "The message pushes you to act quickly."],
  [/\b(?:registration|joining|activation|processing) fee\b|\bpay to join\b/i, "The message asks you to pay to join."],
  [/\bcomplete tasks?\b|\bwatch videos?\b|\bearn per task\b/i, "The message offers pay for simple tasks."],
  [/\bsec[- ](?:approved|licensed|registered)\b|\bapproved by (?:the )?sec\b/i, "The message claims approval from a regulator."],
];

/** Describes what the message says. It makes no judgement about the sender. */
export function warningSigns(text) {
  const input = String(text || "");
  return SIGNS.filter(([pattern]) => pattern.test(input)).map(([, sign]) => sign);
}

export const WARNING_SIGN_TEMPLATES = SIGNS.map(([, sign]) => sign);
