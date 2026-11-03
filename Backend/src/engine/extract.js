import { normalizeAppId, normalizeDomain, normalizePhone, normalizeWallet } from "../lib/identifiers.js";

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
  const apps = [];

  for (const link of linksIn(input.replace(WALLET, " "))) {
    const host = normalizeDomain(link);
    const appId = normalizeAppId(link);
    if (appId) apps.push(appId);
    else if (MANUAL_REVIEW_HOSTS.test(host)) manualReview.push(socialLink(link));
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
    app_ids: unique(apps),
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
  [/\bfree gifts?\b|\b(?:sign[- ]?up|welcome|joining|referral|registration) bonus\b|\bclaim (?:your|a|the) (?:\w+ )?(?:bonus|gift|reward|prize)\b|\byou(?:'ve| have) won\b|\bfree (?:airtime|data|cash|money)\b/i, "The message offers bonuses or free gifts."],
  [/\baccess (?:to )?your (?:contacts?|phone ?book|photos|gallery|sms|messages)\b|\b(?:read|upload|share) your (?:contacts?|phone ?book)\b|\bcontact list\b/i, "The message asks for access to your contacts or personal data."],
  [/\bpersonal (?:account|momo|mobile money|wallet)\b/i, "The message asks you to pay into a personal account."],
  [/\bgift ?cards?\b|\bpay(?:ment)? (?:in|with|by) (?:usdt|btc|bitcoin|crypto)\b|\b(?:usdt|btc|bitcoin|crypto) only\b|\bsend (?:usdt|btc|bitcoin|crypto)\b/i, "The message asks for payment by crypto, gift card or a similar method."],

  /* --- Messages that pose as an official demand -------------------------
   *
   * The signs above all describe an offer. This family describes a demand:
   * a fine, a held parcel, an account about to be stopped. The pretext is
   * different but the ask is the same one Qwench exists for — click here,
   * then pay or hand over your details.
   *
   * Each sentence describes what the message SAYS. A real DVLA notice would
   * trip the first one too, and that is correct: the sign is an observation,
   * not an accusation. What separates the two is the link, and that is a
   * link fact, not a sign. */
  [/\bofficial\s+(?:traffic\s+)?(?:message|notice|portal|website|site|communication)\b|\b(?:dvla|mttd|nrsa|ghana\s+police|police\s+service|road\s+safety\s+authority|ghana\s+revenue\s+authority|customs\s+division)\b/i, "The message says it comes from a government or official body."],
  [/\b(?:traffic|driving|speeding|parking|road)\s+(?:violation|offence|offense|fine|ticket|penalty|charge)\b|\b(?:unpaid|outstanding|overdue)\s+(?:fine|ticket|toll|penalty|tax|levy)\b/i, "The message says you owe a fine or penalty."],
  [/\byour\s+(?:account|number|sim|line|service|card|wallet)\s+(?:has been|will be|is about to be|shall be)\s+(?:suspend|block|deactivat|restrict|clos|lock)(?:ed|e)?\b|\bto avoid (?:suspension|disconnection|deactivation|closure)\b/i, "The message says your account or service will be stopped."],
  [/\b(?:parcel|package|shipment|delivery|consignment)\b[^.]{0,40}\b(?:held|pending|customs|duty|fee|reschedul|undeliver|address)/i, "The message says a parcel or delivery needs something from you."],
  [/\b(?:confirm|verify|update|validate|re-?enter)\s+your\s+(?:details|information|identity|account|card|payment|billing|address|pin|password)\b/i, "The message asks you to confirm personal or payment details."],
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
  bonus_gift: { sign: "The message offers bonuses or free gifts." },
  pay_personal_account: { sign: "The message asks you to pay into a personal account.", quoteShows: /\b(?:personal|my|own|private|agent'?s)\b/i },
  unusual_payment: { sign: "The message asks for payment by crypto, gift card or a similar method.", quoteShows: /crypto|bitcoin|\bbtc\b|usdt|\beth\b|gift ?card|voucher|wallet|western union/i },
  famous_endorsement: { sign: "The message uses a well-known person's name to promote the offer." },
  /* The demand family. Rules above catch the English wording these campaigns
   * reuse; these codes let the model catch the same pretext when it is
   * reworded, mistyped, or read out of a screenshot. Each still has to quote
   * words that are really in the material, and quoteShows keeps the model from
   * hanging the sign on a word that does not carry it. */
  official_body_claim: { sign: "The message says it comes from a government or official body.", quoteShows: /official|government|police|authority|ministry|customs|court|dvla|mttd|nrsa|revenue|licen[cs]e|directorate|commission|department|agency|bureau|municipal|assembly/i },
  fine_demand: { sign: "The message says you owe a fine or penalty.", quoteShows: /fine|penalt|violation|offen[cs]e|ticket|toll|unpaid|outstanding|overdue|summons/i },
  service_suspension: { sign: "The message says your account or service will be stopped.", quoteShows: /suspend|deactivat|block|restrict|clos|disconnect|lock|terminat/i },
  delivery_pretext: { sign: "The message says a parcel or delivery needs something from you.", quoteShows: /parcel|package|shipment|deliver|consignment|customs|courier/i },
  detail_harvest: { sign: "The message asks you to confirm personal or payment details.", quoteShows: /confirm|verify|update|validate|re-?enter|details|identity|card number|pin|password|otp/i },

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

/**
 * The signs that mean the message made a demand rather than an offer.
 *
 * A report keyed only to the legal state asks a person forwarding a traffic
 * fine whether the sender promised guaranteed returns, which is the wrong
 * question and reads as though nothing was understood. This lets the report
 * ask about the pretext in front of the reader instead.
 */
export const DEMAND_SIGNS = new Set([
  "The message says it comes from a government or official body.",
  "The message says you owe a fine or penalty.",
  "The message says your account or service will be stopped.",
  "The message says a parcel or delivery needs something from you.",
  "The message asks you to confirm personal or payment details.",
]);

export const isDemandMessage = (signs = []) => signs.some((sign) => DEMAND_SIGNS.has(sign));
