import { WARNING_SIGN_TEMPLATES, isDemandMessage, warningSigns } from "./extract.js";

/**
 * Every word Qwench says in a result comes from this file, as a fixed template.
 *
 * Qwench's own wording never gives a score or a verdict, and test/report.test.js
 * checks every template for banned words. The one allowed use of "safe" is
 * NO_RECORD_SENTENCE.
 */

export const NO_RECORD_SENTENCE = "No record found. This does not mean it is safe or unsafe.";

const SENTENCES = {
  notice: "{publisher} named {entity} in a notice dated {date}.",
  sanction: "{entity} is on a sanctions list published by {publisher}, dated {date}.",
  licensed: "{entity} is on {publisher}'s list as a {licenseType}, dated {date}.",
  licensedNoType: "{entity} is on {publisher}'s list of licensed firms, dated {date}.",
  sandbox: "{entity} is in {publisher}'s sandbox, dated {date}. This is provisional approval, not a full licence.",
  registered: "{entity} is registered with {publisher}, dated {date}.",
  merchant: "Registered by {business}. This shows who controls the number, and nothing more.",
  impersonation: "Qwench reviewed this and found {entity} presented as {business}, without being part of {business}.",
  authority: "{entity} is a regulator or public body, not an investment.",
  didYouMean: "Did you mean {entity}?",
  foreign: "Context only: {publisher}, a regulator outside Ghana ({jurisdiction}), published an alert. This is not a Ghana finding.",
  demo: "Demo data.",
};

export const NOTES = {
  linkUnread: "A link in this message could not be opened, so its page was not read.",
  imageUnread: "The image could not be read, so nothing in it was checked.",
  imageRead: "Read from an image by AI. Please confirm the details.",
  manualReview: "A TikTok or Telegram link in this message was saved for a person to review.",
};

const ALSO_CHECKED = "{value}: {sentence}";

export const LINK_FACTS = {
  redirect: "The link {from} leads to {to}.",
  shortener: "The link uses a link shortener, which hides where it goes.",
  shortenerShape: "The link is built like a shortened address, so where it goes isn't visible from the message.",
  notGovernment: "The message mentions an official or government portal, but the link goes to {domain}, which is not a Ghana government address ending in .gov.gh.",
  ending: "The website address ends in {ending}, which is on Qwench's list of endings to look at closely.",
  noHttps: "The page doesn't use a secure connection (HTTPS).",
  login: "The page asks for a password.",
  payment: "The page has a payment form.",
  deadControls: "Most of the page's links and buttons don't go anywhere, even though they look clickable.",
  mismatchedLink: "A link on the page shows one address but goes to another.",
  oddLink: "A link on the page uses an unusual address, such as a bare number or a look-alike character set.",
  chatLinks: "Most of the page's links go to a chat app such as WhatsApp or Telegram.",
  sameTimes: "The page's comments all show the same time.",
  frozenTimes: "The page's comments still show the same times as {hours} {unit} ago, though times like \"2 minutes ago\" normally change.",
  newSite: "The website {domain} was registered {days} {unit} ago, on {date}. A new website isn't proof of anything on its own.",
};

export const linkFact = (name, values = {}) => fill(LINK_FACTS[name], values);

/**
 * How much evidence Qwench has, set by fixed rules. It grades the evidence, never the
 * scheme, so there is no "safe", no "unsafe", no number and no likelihood. AI has no say
 * in it: signs AI spots are shown, but aren't counted. Members-only levels can't reach a
 * public reply, because partner data, reports and signals are masked before this runs.
 */
export const EVIDENCE_LEVELS = {
  regulator_warning: { label: "Regulator warning", meaning: "A Ghana regulator or sanctions list has named this." },
  reviewed_impersonation: { label: "Reviewed impersonation", meaning: "Two people at Qwench reviewed this and found it using a business's name." },
  foreign_alert: { label: "Alert from a regulator abroad", meaning: "A regulator outside Ghana published an alert. No Ghana regulator record was found." },
  many_signs: { label: "Many warning signs, no regulator record", meaning: "No regulator has named this, but several warning signs were found. See them below." },
  some_signs: { label: "Some warning signs, no regulator record", meaning: "No regulator has named this, but a warning sign was found. See below." },
  on_regulator_list: { label: "On a regulator's list", meaning: "This name is on a regulator's list. This doesn't mean an investment will pay, or that the person contacting you is really from this firm." },
  registered_business: { label: "Registered by a business", meaning: "A business registered this number with Qwench. This shows who controls the number, and nothing more." },
  regulator_or_public_body: { label: "Regulator or public body", meaning: "This is a regulator or public body, not an investment." },
  member_confirmed: { label: "Confirmed by a member", meaning: "A member organisation confirmed this. For internal use unless your organisation has agreed otherwise." },
  corroborated_reports: { label: "Corroborated reports", meaning: "Reports from independent sources, reviewed by a person. For internal review." },
  rise_in_checks: { label: "Reviewed rise in checks", meaning: "Checks on this have risen, and a person reviewed it. For watching only." },
  not_enough: { label: "Not enough to go on", meaning: "Qwench found no regulator record and no warning signs. That doesn't tell you either way, so check further before you pay." },
};

const MANY_SIGNS = 3;

function levelCode({ state, tier, impersonated, foreignContext = [], merchantClaim, signCount = 0 }) {
  if (state === "named_in_notice") return "regulator_warning";
  if (impersonated) return "reviewed_impersonation";
  if (state === "authority") return "regulator_or_public_body";
  if (state === "registered" && merchantClaim) return "registered_business";
  if (["licensed", "sandbox", "registered"].includes(state)) return "on_regulator_list";
  if (tier === 2) return "member_confirmed";
  if (tier === 3) return "corroborated_reports";
  if (tier === 4) return "rise_in_checks";
  if (foreignContext.length) return "foreign_alert";
  if (signCount >= MANY_SIGNS) return "many_signs";
  if (signCount >= 1) return "some_signs";
  return "not_enough";
}

export function evidenceLevel(input) {
  const code = levelCode(input);
  return { code, ...EVIDENCE_LEVELS[code] };
}

export const DISCLAIMER = "This is not a final ruling. It reflects what Qwench could check today. If it's wrong, you can appeal.";

const FOOTER = {
  dated: "Data as of {date}.",
  empty: "No reviewed records are loaded yet.",
  contacts: "SEC Ghana 0800 100 065. Cyber Security Authority 292. Information, not advice.",
};

const QUESTIONS = {
  named_in_notice: ["Has anyone asked you to recruit others or pay to join?", "Were you contacted through WhatsApp, Telegram or social media?"],
  licensed: ["Is the person contacting you really from this firm? You can check using the contact details on the firm's own website."],
  sandbox: ["Are they asking you to invest directly, or through their approved platform?", "Are they presenting sandbox approval as a full licence?"],
  registered: ["Does the name on the payment prompt match the business you expected?"],
  authority: ["Is someone using this body's name to ask you for money?"],
  impersonation: ["Can you confirm this with the business, using the contact details on its own website?"],
  no_record: ["Can you find a licence number on their website, and confirm it with SEC Ghana?", "Do they have a physical office you can visit?", "Have they promised specific returns or guaranteed profits?"],
  // Asked when the message demands something rather than offering it.
  demand: [
    "Were you expecting a notice like this?",
    "Does the link go to a .gov.gh address? That is what Ghana's government services use.",
    "Can you reach the body it names using contact details you looked up yourself, rather than any in the message?",
  ],
};
const SENT_MONEY = "Have you already sent money? If so, you can call the Cyber Security Authority on 292 and your bank.";

const RETURN_NOTE = "That is about {annual}% a year, by simple multiplication. It is not a forecast.";

/** Everything Qwench can say, for the banned-word test. */
export const ALL_TEMPLATES = Object.fromEntries(
  Object.entries({
    NO_RECORD_SENTENCE,
    ...SENTENCES,
    ...Object.fromEntries(Object.entries(FOOTER).map(([k, v]) => [`footer_${k}`, v])),
    SENT_MONEY,
    RETURN_NOTE,
    ALSO_CHECKED,
    ...NOTES,
    DISCLAIMER,
    ...Object.fromEntries(Object.entries(EVIDENCE_LEVELS).flatMap(([k, v]) => [[`level_${k}_label`, v.label], [`level_${k}_meaning`, v.meaning]])),
    ...Object.fromEntries(Object.entries(LINK_FACTS).map(([k, v]) => [`link_fact_${k}`, v])),
    ...Object.fromEntries(Object.entries(QUESTIONS).flatMap(([state, list]) => list.map((q, i) => [`question_${state}_${i}`, q]))),
    ...Object.fromEntries(WARNING_SIGN_TEMPLATES.map((sign, i) => [`warning_sign_${i}`, sign])),
  })
);

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");

const PERIODS = [
  { pattern: /(\d+(?:\.\d+)?)\s*%\s*(?:a day|per day|daily|every day|each day)\b/i, unit: "a day", perYear: 365 },
  { pattern: /(\d+(?:\.\d+)?)\s*%\s*(?:a week|per week|weekly|every week|each week)\b/i, unit: "a week", perYear: 52 },
  { pattern: /(\d+(?:\.\d+)?)\s*%\s*(?:a month|per month|monthly|every month|each month)\b/i, unit: "a month", perYear: 12 },
  { pattern: /(\d+(?:\.\d+)?)\s*%\s*(?:a year|per year|yearly|annually|per annum|p\.a\.)/i, unit: "a year", perYear: 1 },
];

/** One line for something else found in the message. */
export const alsoCheckedLine = (value, sentence) => fill(ALSO_CHECKED, { value, sentence });

/** A stated return, restated per year by simple multiplication. No judgement. */
export function returnCheck(text) {
  const input = String(text || "");
  for (const { pattern, unit, perYear } of PERIODS) {
    const match = input.match(pattern);
    if (!match) continue;
    const rate = parseFloat(match[1]);
    const annual = Math.round(rate * perYear * 100) / 100;
    return {
      stated: `${rate}% ${unit}`,
      annual_percent: annual,
      note: fill(RETURN_NOTE, { annual: annual.toLocaleString("en-US") }),
    };
  }
  return null;
}

function stateSentence({ state, entity, sources, merchantClaim, didYouMean, impersonated }) {
  if (impersonated) return fill(SENTENCES.impersonation, { entity, business: impersonated });

  const pick = (...types) => sources.find((s) => types.includes(s.record_type)) || sources[0] || {};

  if (state === "named_in_notice") {
    const source = pick("warning", "sanction");
    return fill(source.record_type === "sanction" ? SENTENCES.sanction : SENTENCES.notice, { entity, ...source });
  }
  if (state === "licensed") {
    const source = pick("licence");
    return fill(source.license_type ? SENTENCES.licensed : SENTENCES.licensedNoType, { entity, licenseType: source.license_type, ...source });
  }
  if (state === "sandbox") return fill(SENTENCES.sandbox, { entity, ...pick("sandbox") });
  if (state === "registered") {
    if (merchantClaim) return fill(SENTENCES.merchant, merchantClaim);
    return fill(SENTENCES.registered, { entity, ...pick("registration") });
  }
  if (state === "authority") return fill(SENTENCES.authority, { entity });
  if (didYouMean) return `${NO_RECORD_SENTENCE} ${fill(SENTENCES.didYouMean, { entity: didYouMean.suggested_entity })}`;
  return NO_RECORD_SENTENCE;
}

export function buildReport({ state, tier = null, entity, sources = [], foreignContext = [], merchantClaim, didYouMean, impersonated, text, dataDate, isDemo = false }) {
  const signs = warningSigns(text);
  const stateQuestions = QUESTIONS[impersonated ? "impersonation" : state] || [];
  // A demand puts its own questions first. On a plain no-record reply they
  // replace the investment ones outright, which would otherwise ask someone
  // forwarding a traffic fine about guaranteed profits.
  const questions = [
    ...new Set([
      ...(isDemandMessage(signs) ? QUESTIONS.demand : []),
      ...(isDemandMessage(signs) && state === "no_record" && !impersonated ? [] : stateQuestions),
      ...(signs.length > 2 ? [SENT_MONEY] : []),
    ]),
  ];
  const sentence = stateSentence({ state, entity, sources, merchantClaim, didYouMean, impersonated });

  return {
    state_sentence: isDemo ? `${SENTENCES.demo} ${sentence}` : sentence,
    foreign_context: foreignContext.map((f) => fill(SENTENCES.foreign, f)),
    also_checked: [],
    sources: sources.map(({ publisher, date, url }) => ({ publisher, date, url })),
    return_check: returnCheck(text),
    warning_signs: signs,
    ai_warning_signs: [],
    link_facts: [],
    questions_to_ask: questions,
    notes: [],
    evidence_level: evidenceLevel({ state, tier, impersonated, foreignContext, merchantClaim, signCount: signs.length }),
    disclaimer: DISCLAIMER,
    footer: `${dataDate ? fill(FOOTER.dated, { date: dataDate }) : FOOTER.empty} ${FOOTER.contacts}`,
  };
}
