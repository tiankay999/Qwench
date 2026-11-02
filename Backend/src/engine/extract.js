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
  const links = [];
  const manualReview = [];

  for (const link of linksIn(input.replace(WALLET, " "))) {
    const host = normalizeDomain(link);
    if (MANUAL_REVIEW_HOSTS.test(host)) manualReview.push(socialLink(link));
    else if (host) {
      domains.push(host);
      links.push(/^https?:\/\//i.test(link) ? link : `https://${link}`);
    }
  }

  return {
    names: [],
    domains: unique(domains),
    links: unique(links),
    numbers: unique((input.match(PHONE) || []).map(normalizePhone).filter((n) => /^\+233\d{9}$/.test(n))),
    wallets: unique((input.match(WALLET) || []).map(normalizeWallet)),
    manual_review: unique(manualReview),
  };
}

// Payment methods and platforms that AI sometimes reports as company names.
const NOT_NAMES = new Set(["momo", "mobile money", "whatsapp", "telegram", "tiktok", "facebook", "instagram", "twitter", "x", "youtube", "visa", "mastercard"]);

/** AI can add candidates, but each one must literally appear in the message. */
export function mergeAiCandidates(rules, ai, text) {
  if (!ai || ai.error) return rules;

  const haystack = String(text || "").toLowerCase();
  const grounded = (items) => (items || []).map((v) => String(v).trim()).filter((v) => v && haystack.includes(v.toLowerCase()));

  return {
    ...rules,
    names: unique([...rules.names, ...grounded(ai.entities_mentioned).filter((n) => !NOT_NAMES.has(n.toLowerCase()))]),
    numbers: unique([...rules.numbers, ...grounded(ai.numbers_found).map(normalizePhone).filter((n) => /^\+233\d{9}$/.test(n))]),
    domains: unique([...rules.domains, ...grounded(ai.domains_found).map(normalizeDomain).filter(Boolean)]),
    wallets: unique([...rules.wallets, ...grounded(ai.wallets_found).map(normalizeWallet)]),
  };
}

const AIMED_AT_AI = [
  /\b(?:ignore|disregard|forget)\b[^.!?\n]{0,40}\b(?:instructions?|rules?|prompts?)\b/i,
  /\bsystem (?:note|prompt|message)\b/i,
  /\bas an ai\b/i,
  /\b(?:note|message|instructions?) (?:to|for) (?:the |any |all )?(?:ai|assistant|model|llm|chatbot)\b/i,
  /^\s*assistant\s*:/im,
  /\bset (?:the )?(?:tier|state|status|score)\b/i,
];

/** Text written to steer an AI that reads it. Rules decide this, not AI. */
export const aimedAtAi = (text) => AIMED_AT_AI.some((pattern) => pattern.test(String(text || "")));

const AIMED_AT_AI_SIGN = "The message includes text aimed at AI tools.";
export const HIDDEN_AI_TEXT_SIGN = "The page has hidden text aimed at AI tools.";
export const HIDDEN_AI_IMAGE_SIGN = "The image has hidden text aimed at AI tools.";

const SIGNS = [
  [/\bguarantee[ds]?\b|\bassured\b/i, "The message promises guaranteed returns."],
  [/\brisk[- ]?free\b|\bno risk\b|\b100% safe\b/i, "The message says there is no risk."],
  [/\bdouble your\b|\bdoubler\b/i, "The message says your money will double."],
  [/\brefer(?:ral)?\b|\brecruit\b|\bdownline\b|\binvite \d+\b/i, "The message asks you to bring in other people."],
  [/\bonly today\b|\blast chance\b|\bact now\b|\bhurry\b|\burgent\b|\blimited slots?\b/i, "The message pushes you to act quickly."],
  [/\b(?:registration|joining|activation|processing) fee\b|\bpay to join\b/i, "The message asks you to pay to join."],
  [/\bcomplete tasks?\b|\bwatch videos?\b|\bearn per task\b/i, "The message offers pay for simple tasks."],
  [/\bsec[- ](?:approved|licensed|registered)\b|\bapproved by (?:the )?sec\b/i, "The message claims approval from a regulator."],
  [/\btell (?:nobody|no one|no-one)\b|\bdon'?t tell (?:anyone|anybody)\b|\bdo not tell (?:anyone|anybody)\b|\bkeep this (?:private|secret|to yourself)\b|\bbetween us\b/i, "The message asks you to keep this offer private."],
  [/\bpersonal (?:account|momo|mobile money|wallet)\b/i, "The message asks you to pay into a personal account."],
  [/\bgift ?cards?\b|\bpay(?:ment)? (?:in|with|by) (?:usdt|btc|bitcoin|crypto)\b|\b(?:usdt|btc|bitcoin|crypto) only\b|\bsend (?:usdt|btc|bitcoin|crypto)\b/i, "The message asks for payment by crypto, gift card or a similar method."],
];

/** Describes what the message says. It makes no judgement about the sender. */
export function warningSigns(text) {
  const input = String(text || "");
  const signs = SIGNS.filter(([pattern]) => pattern.test(input)).map(([, sign]) => sign);
  return aimedAtAi(input) ? [...signs, AIMED_AT_AI_SIGN] : signs;
}

/** Zero-width characters can split a number or name while looking normal. */
export const cleanText = (text) => String(text || "").replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "");

/**
 * What AI may spot, and the only words Qwench will use for it. AI picks a code and
 * quotes the words that show it. It can't add a code, write a sign, or give a rating.
 */
export const AI_RED_FLAGS = {
  guaranteed_returns: { sign: "The message promises guaranteed returns." },
  no_risk: { sign: "The message says there is no risk." },
  money_doubling: { sign: "The message says your money will double." },
  recruitment: { sign: "The message asks you to bring in other people." },
  urgency: { sign: "The message pushes you to act quickly." },
  pay_to_join: { sign: "The message asks you to pay to join." },
  task_earnings: { sign: "The message offers pay for simple tasks." },
  regulator_claim: { sign: "The message claims approval from a regulator." },
  secrecy: { sign: "The message asks you to keep this offer private." },
  pay_personal_account: { sign: "The message asks you to pay into a personal account.", quoteShows: /\b(?:personal|my|own|private|agent'?s)\b/i },
  unusual_payment: { sign: "The message asks for payment by crypto, gift card or a similar method.", quoteShows: /crypto|bitcoin|\bbtc\b|usdt|\beth\b|gift ?card|voucher|wallet|western union/i },
  famous_endorsement: { sign: "The message uses a well-known person's name to promote the offer." },
  official_imagery: { sign: "The image uses official-looking seals or government imagery.", visual: true },
  payout_screenshots: { sign: "The image shows payouts or balances as proof of earnings.", visual: true },
  hidden_text: { sign: "The image seems to have faint or hidden text.", visual: true },
};

const squash = (text) => String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
const MIN_QUOTE = 4;

/** Keeps a red flag only if its code is listed and its proof is really there. */
export function aiWarningSigns(ai, text, { fromImage = false } = {}) {
  if (!Array.isArray(ai?.red_flags)) return [];

  const haystack = squash(text);
  const ruleSigns = warningSigns(text);
  const signs = [];

  for (const flag of ai.red_flags) {
    const known = typeof flag?.code === "string" && Object.hasOwn(AI_RED_FLAGS, flag.code) ? AI_RED_FLAGS[flag.code] : null;
    if (!known) continue;

    const quote = squash(flag.quote);
    const proven = known.visual ? fromImage : quote.length >= MIN_QUOTE && haystack.includes(quote) && (!known.quoteShows || known.quoteShows.test(quote));
    if (proven && !ruleSigns.includes(known.sign) && !signs.includes(known.sign)) signs.push(known.sign);
  }
  return signs;
}

export const WARNING_SIGN_TEMPLATES = [...SIGNS.map(([, sign]) => sign), AIMED_AT_AI_SIGN, HIDDEN_AI_TEXT_SIGN, HIDDEN_AI_IMAGE_SIGN, ...Object.values(AI_RED_FLAGS).map((f) => f.sign)];
