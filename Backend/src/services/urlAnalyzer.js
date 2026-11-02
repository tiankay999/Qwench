import * as cheerio from "cheerio";

import { cleanText } from "../engine/extract.js";
import { safeFetch } from "../lib/safeFetch.js";

import { runJsonPrompt } from "./aiAnalyzer.js";
import { secData } from "./secData.js";

/**
 * Fetches a page the user sent as evidence and has the model read it for
 * investment-fraud signals.
 */

export const URL_SYSTEM_PROMPT = `You are Qwench URL Analyzer. You examine website content for investment fraud red flags, for users in Ghana.

Analyze the supplied page content against SEC Ghana's fraud indicators. Check for:
- No physical address or only a PO box
- No SEC Ghana licence number displayed anywhere
- Unrealistic or guaranteed return promises (SEC Ghana cites 6%, 10%, 20%, 40%, 70% monthly as fraud indicators)
- "Daily profit" / "fixed daily returns" language (Ponzi indicator)
- Task-based or recruitment-based earning ("complete tasks", "refer 5 friends", "downline")
- Login or payment forms collecting money or credentials
- Content that looks copied from a legitimate financial site
- No terms of service or privacy policy
- Contact only through WhatsApp, Telegram or social media
- Fake testimonials, stock-photo teams, or celebrity endorsements
- Countdown timers or urgency language
- Use of Ghana government imagery or seals to look official

SEC Ghana's legal framework: Securities Industry Act 2016 (Act 929), Act 1062 (2021), Virtual Asset Service Providers Act 2025 (Act 1154), SEC Public Notice SEC/PN/002/07/2025. Operating without a licence breaches Section 109 of Act 929.

Judge only what the content shows. If the page could not be fetched or is unrelated to investments, say so rather than inventing findings.

Return JSON ONLY:
{
  "extractedText": "the key claims found on the page",
  "entityMentioned": "company/scheme name if present",
  "redFlags": [{"flag": "...", "severity": "critical|high|medium|low"}],
  "positiveSignals": [{"signal": "..."}],
  "returnPromises": "any % or return claims found",
  "urlsFound": ["notable outbound links"],
  "imageType": "website",
  "confidence": "high|medium|low",
  "summary": "one sentence about what this site is"
}`;

const HIDDEN_STYLE = /display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(?![.\d])|opacity\s*:\s*0(?![.\d])|(?:left|top|text-indent)\s*:\s*-\d{3,}|color\s*:\s*#fff(?:fff)?\s*;\s*background(?:-color)?\s*:\s*#fff(?:fff)?/i;

const TIMEOUT = 10000;
const MAX_BODY = 3000;

/** Fetch and strip a page down to the parts worth reading. */
export async function scrapeUrl(url, fetchOptions = {}) {
  try {
    const response = await safeFetch(url, { timeoutMs: TIMEOUT, ...fetchOptions });
    const finalUrl = new URL(response.finalUrl);

    const $ = cheerio.load(String(response.body || ""));
    $("script, style, noscript, template").remove();

    // Text a person can't see can still reach an AI or the rules, so it's taken out.
    // Its contents are kept only to check whether it's aimed at AI. Only inline styles
    // can be read here: a page can still hide text with its own style sheet.
    const hidden = $("[hidden], [aria-hidden='true'], input[type='hidden']").add(
      $("[style]").filter((_, el) => HIDDEN_STYLE.test($(el).attr("style") || ""))
    );
    const hiddenText = cleanText(hidden.text()).replace(/\s+/g, " ").trim().slice(0, MAX_BODY);
    hidden.remove();

    const page = {
      error: false,
      title: $("title").first().text().trim().slice(0, 300),
      metaDescription: ($('meta[name="description"]').attr("content") || "").trim().slice(0, 500),
      bodyText: cleanText($("body").text()).replace(/\s+/g, " ").trim().slice(0, MAX_BODY),
      hiddenText,
      links: $("a")
        .map((_, el) => $(el).attr("href"))
        .get()
        .filter(Boolean)
        .slice(0, 20),
      hasLoginForm: $('input[type="password"]').length > 0,
      hasPaymentForm: $('input[name*="card" i], input[name*="payment" i], input[name*="momo" i]').length > 0,
      images: $("img")
        .map((_, el) => $(el).attr("alt") || $(el).attr("src"))
        .get()
        .filter(Boolean)
        .slice(0, 10),
      statusCode: response.status,
      finalUrl: response.finalUrl,
      isHttps: finalUrl.protocol === "https:",
      suspiciousTld: secData.suspiciousTlds.find((t) => finalUrl.hostname.endsWith(t)) || null,
    };

    return page;
  } catch (err) {
    console.warn(`[url] fetch refused or failed: ${err.code || err.name}`);
    return { error: true, statusCode: null, code: err.code, message: err.message };
  }
}

/**
 * Scrape a URL and have the model assess it. Never throws.
 */
export async function analyzeUrl(url, entityName = "", { callProvider, page } = {}) {
  const content = page || (await scrapeUrl(url));

  if (content.error) {
    return {
      error: true,
      url,
      summary: `Could not open ${url} — ${content.message}`,
      redFlags: [
        {
          flag: `The link ${url} could not be opened (${content.message}) — a site that is down or unreachable is itself a warning sign`,
          severity: "medium",
        },
      ],
      positiveSignals: [],
      urlsFound: [],
    };
  }

  const user = `Analyze this website for investment fraud red flags. The user is asking about an entity called "${entityName || "unknown"}".

URL: ${url}
Final URL after redirects: ${content.finalUrl}
HTTP status: ${content.statusCode}
Served over HTTPS: ${content.isHttps ? "yes" : "NO — not encrypted"}
${content.suspiciousTld ? `Domain uses the ${content.suspiciousTld} TLD, common in throwaway scam sites\n` : ""}Page title: ${content.title || "(none)"}
Meta description: ${content.metaDescription || "(none)"}
Has a password/login form: ${content.hasLoginForm ? "YES" : "no"}
Has a card/payment form: ${content.hasPaymentForm ? "YES" : "no"}
Image alt text: ${content.images.join(" | ") || "(none)"}
Outbound links: ${content.links.join(" | ") || "(none)"}

Page text:
${content.bodyText || "(no readable text)"}`;

  try {
    const { parsed, latencyMs, provider, model } = await runJsonPrompt({
      system: URL_SYSTEM_PROMPT,
      user,
      callProvider,
    });

    const result = normalizeUrlResult(parsed, url, content);
    console.log(`[url] ${provider}/${model} found ${result.redFlags.length} flag(s) for ${url} in ${latencyMs}ms`);
    return result;
  } catch (err) {
    console.error(`[url] analysis failed: ${err.name}`);
    // The scrape still produced hard facts; report those rather than nothing.
    return { ...deterministicUrlFlags(url, content), error: false, degraded: true, reason: err.message };
  }
}

const SEVERITIES = ["critical", "high", "medium", "low"];

function normalizeUrlResult(p, url, content) {
  const flags = (Array.isArray(p.redFlags) ? p.redFlags : [])
    .map((f) => {
      if (typeof f === "string") return { flag: f, severity: "medium" };
      const sev = String(f?.severity || "").toLowerCase();
      return { flag: String(f?.flag || "").trim(), severity: SEVERITIES.includes(sev) ? sev : "medium" };
    })
    .filter((f) => f.flag);

  const confidence = String(p.confidence || "").toLowerCase();
  const base = deterministicUrlFlags(url, content);

  return {
    error: false,
    url,
    finalUrl: content.finalUrl,
    extractedText: String(p.extractedText || "").slice(0, 4000),
    entityMentioned: String(p.entityMentioned || "").trim(),
    // Facts we observed ourselves come first; they are not up to the model.
    redFlags: dedupeFlags([...base.redFlags, ...flags]),
    positiveSignals: (Array.isArray(p.positiveSignals) ? p.positiveSignals : [])
      .map((s) => (typeof s === "string" ? { signal: s } : { signal: String(s?.signal || "").trim() }))
      .filter((s) => s.signal),
    returnPromises: String(p.returnPromises || "").trim(),
    urlsFound: (Array.isArray(p.urlsFound) ? p.urlsFound : []).map((u) => String(u).trim()).filter(Boolean),
    imageType: "website",
    confidence: ["high", "medium", "low"].includes(confidence) ? confidence : "low",
    summary: String(p.summary || "").trim() || `Analyzed ${url}`,
  };
}

/** Red flags we can state from the scrape alone, with no model involved. */
function deterministicUrlFlags(url, content) {
  const redFlags = [];

  if (content.suspiciousTld) {
    redFlags.push({
      flag: `Website uses the ${content.suspiciousTld} domain, common in throwaway scam sites`,
      severity: "high",
    });
  }
  if (!content.isHttps) {
    redFlags.push({ flag: "Site is not served over HTTPS — anything you type is unencrypted", severity: "high" });
  }
  if (content.hasPaymentForm) {
    redFlags.push({ flag: "Page collects card or mobile money details directly", severity: "high" });
  }
  if (content.hasLoginForm && !content.isHttps) {
    redFlags.push({ flag: "Asks for a password over an unencrypted connection", severity: "critical" });
  }

  return {
    url,
    finalUrl: content.finalUrl,
    redFlags,
    positiveSignals: [],
    urlsFound: [],
    imageType: "website",
    confidence: "low",
    summary: `Fetched ${url} (HTTP ${content.statusCode}) but could not run the AI read`,
    extractedText: (content.bodyText || "").slice(0, 1000),
    entityMentioned: "",
    returnPromises: "",
  };
}

function dedupeFlags(flags) {
  const seen = new Set();
  return flags.filter((f) => {
    const k = f.flag.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Pull http(s) URLs out of a message. */
export function extractUrls(text) {
  return String(text || "").match(/https?:\/\/[^\s<>"')]+/gi) || [];
}
