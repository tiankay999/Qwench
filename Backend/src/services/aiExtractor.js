// AI EXTRACTION — a helper, never the decision-maker.
//
// The model's only job is to read an image or a page and report what it can
// see: text, names, numbers, domains, return claims. It is never asked whether
// something is a scam, how risky it is, or what the user should do. Those are
// the evidence engine's calls, made from records and rules.
//
// Anything the model writes in prose is treated as untrusted: it is labelled
// as AI-extracted, and discarded entirely if it contains a banned word or
// states something absent from the source text.

import { runJsonPrompt } from "./aiAnalyzer.js";
import { scrapeUrl } from "./urlAnalyzer.js";

/* ------------------------------------------------------------------ *
 * Guardrails
 * ------------------------------------------------------------------ */

/**
 * Words that would turn an extraction into a judgement. If the model uses
 * one, the text is thrown away rather than shown -- Qwench never calls
 * anything safe, never calls anything a scam, and never gives advice.
 */
export const BANNED_WORDS = [
  "safe",
  "unsafe",
  "legitimate",
  "scam",
  "fraud",
  "ponzi",
  "recommend",
  "advise",
  "should invest",
  "should not invest",
  "trust",
  "trustworthy",
  "reliable",
];

/** False when the text contains a banned word. */
export function validateAiOutput(text) {
  if (!text) return true;
  const lower = String(text).toLowerCase();
  return !BANNED_WORDS.some((word) => lower.includes(word));
}

/**
 * Drop any claim that is not supported by the source text.
 *
 * A model asked to extract will sometimes add a detail that was never on the
 * page. Each extracted string has to appear in what was actually read.
 */
export function keepGrounded(items, sourceText) {
  const haystack = String(sourceText || "").toLowerCase();
  return (items || [])
    .map((v) => String(v).trim())
    .filter(Boolean)
    .filter((v) => haystack.includes(v.toLowerCase()));
}

const EXTRACTION_SYSTEM_PROMPT = `You are Qwench Extractor. You read screenshots, flyers and web pages and report ONLY what is literally present.

You do NOT assess risk. You do NOT decide if something is a scam or legitimate. You do NOT give advice or recommendations. You do NOT rate, score or rank anything. Another system makes those decisions from regulatory records.

Report only what is visibly present in the material. If a field is not present, return an empty value for it. Never infer, guess or add context from your own knowledge.

Return JSON ONLY:
{
  "extracted_text": "all readable text, verbatim",
  "entities_mentioned": ["company or scheme names that appear"],
  "numbers_found": ["phone, MoMo or account numbers that appear"],
  "domains_found": ["domains or URLs that appear"],
  "wallets_found": ["crypto addresses that appear"],
  "return_claims": ["exact wording of any return or profit promise"],
  "platforms": ["TikTok, Telegram, WhatsApp etc. where mentioned"],
  "has_login_form": false,
  "has_payment_form": false
}`;

/* ------------------------------------------------------------------ *
 * Normalising the model's reply
 * ------------------------------------------------------------------ */

function shape(parsed, sourceText) {
  const text = String(parsed.extracted_text || "").slice(0, 6000);
  // Ground every list against the text the model says it read.
  const corpus = `${text} ${sourceText || ""}`;

  return {
    extracted_text: validateAiOutput(text) ? text : "",
    extracted_text_rejected: !validateAiOutput(text),
    entities_mentioned: keepGrounded(parsed.entities_mentioned, corpus).slice(0, 20),
    numbers_found: keepGrounded(parsed.numbers_found, corpus).slice(0, 20),
    domains_found: keepGrounded(parsed.domains_found, corpus).slice(0, 20),
    wallets_found: keepGrounded(parsed.wallets_found, corpus).slice(0, 20),
    return_claims: keepGrounded(parsed.return_claims, corpus).slice(0, 20),
    platforms: keepGrounded(parsed.platforms, corpus).slice(0, 10),
    has_login_form: Boolean(parsed.has_login_form),
    has_payment_form: Boolean(parsed.has_payment_form),
    // Everything here came from a model, and is labelled as such wherever shown.
    source: "ai_extraction",
  };
}

const EMPTY = {
  extracted_text: "",
  entities_mentioned: [],
  numbers_found: [],
  domains_found: [],
  wallets_found: [],
  return_claims: [],
  platforms: [],
  has_login_form: false,
  has_payment_form: false,
  source: "ai_extraction",
};

/* ------------------------------------------------------------------ *
 * Entry points
 * ------------------------------------------------------------------ */

/** Read a screenshot or flyer. Never throws. */
export async function extractFromImage(base64Image, mimeType = "image/jpeg", { callProvider } = {}) {
  if (!base64Image) return { ...EMPTY, error: "no image data" };

  try {
    const { parsed, provider, model, latencyMs } = await runJsonPrompt({
      system: EXTRACTION_SYSTEM_PROMPT,
      user: "Extract everything present in this image. Report only what is literally visible.",
      images: [{ base64: base64Image, mimeType }],
      vision: true,
      callProvider,
    });

    const out = shape(parsed, "");
    console.log(
      `[extract] image via ${provider}/${model} in ${latencyMs}ms: ` +
        `${out.entities_mentioned.length} name(s), ${out.numbers_found.length} number(s), ${out.return_claims.length} claim(s)`
    );
    return out;
  } catch (err) {
    console.error(`[extract] image extraction failed: ${err.name}`);
    return { ...EMPTY, error: err.message };
  }
}

/** Fetch a page and read it. Never throws. */
export async function extractFromUrl(url, { callProvider, page } = {}) {
  const content = page || (await scrapeUrl(url));

  if (content.error) {
    return { ...EMPTY, error: content.message, page_title: "" };
  }

  // Facts observed by the scraper, not by the model.
  const observed = {
    page_title: content.title || "",
    has_login_form: Boolean(content.hasLoginForm),
    has_payment_form: Boolean(content.hasPaymentForm),
  };

  try {
    const { parsed, provider, model } = await runJsonPrompt({
      system: EXTRACTION_SYSTEM_PROMPT,
      user: `Extract everything present on this page. Report only what is literally in the text.\n\nURL: ${url}\nTitle: ${content.title}\n\n${content.bodyText}`,
      callProvider,
    });

    const out = shape(parsed, content.bodyText);
    console.log(`[extract] url via ${provider}/${model}: ${out.entities_mentioned.length} name(s)`);

    // The scraper's observations win over the model's.
    return { ...out, ...observed };
  } catch (err) {
    console.error(`[extract] url extraction failed: ${err.name}`);
    return { ...EMPTY, ...observed, extracted_text: (content.bodyText || "").slice(0, 2000), error: err.message };
  }
}

export default { extractFromImage, extractFromUrl, validateAiOutput, BANNED_WORDS };
