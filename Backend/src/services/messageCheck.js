import { HIDDEN_AI_IMAGE_SIGN, HIDDEN_AI_TEXT_SIGN, aiWarningSigns, aimedAtAi, cleanText, extract, mergeAiCandidates } from "../engine/extract.js";
import { NOTES, alsoCheckedLine, evidenceLevel, linkFact } from "../engine/report.js";
import { EXACT_MATCH_ONLY, hashIdentifier, normalizeDomain, normalizeIdentifier, normalizeName } from "../lib/identifiers.js";
import { Merchant, PublicReport } from "../models/index.js";
import { extractFromImage, extractFromUrl } from "./aiExtractor.js";
import { domainAge as lookUpDomainAge } from "./domainAge.js";
import { evaluate, reviewedEntities } from "./evidenceEngine.js";
import { findLookalikesInText, findNamesInText } from "./nameVerifier.js";
import { frozenFor } from "./pageSeen.js";
import { scrapeUrl } from "./urlAnalyzer.js";

/**
 * Checks a whole message: text, links and an image.
 *
 * Rules find what to look up, and AI can add candidates that literally appear in
 * what was read. AI failing, or being switched off, never fails the check. Each
 * candidate goes through the evidence engine, and the most significant result
 * becomes the reply. Nothing here decides a status, tier or wording.
 */

const MAX_LINKS = 3;
const MAX_CANDIDATES = 10;
const MAX_READ_TEXT = 20_000;

const PAYMENT_TYPES = new Set(["momo_number", "bank_account", "wallet"]);

const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "cutt.ly", "rb.gy", "is.gd", "shorturl.at", "t.co", "goo.gl", "ow.ly", "wa.me"]);
// Free endings only. Paid ones such as .xyz are widely used, and prove nothing.
const WATCHED_ENDINGS = [".tk", ".ml", ".ga", ".cf", ".gq"];

/**
 * A shortener Qwench has never seen.
 *
 * The list above holds the ten everybody knows, and a campaign only has to
 * register one more to walk past it — the traffic-fine run of late 2026 used
 * d1.mk, which is on no list anywhere. What it cannot hide is the shape: a
 * two-label host of a few characters, and a path that is one short run of
 * random-looking characters and nothing else.
 *
 * Deliberately narrow. sec.gov.gh has three labels; a real page's path has
 * words, slashes or an extension. The cost of a miss is one missing fact; the
 * cost of a false hit is telling someone a normal link hides where it goes.
 */
const SHORT_HOST = /^[a-z0-9-]{1,7}\.[a-z]{2,6}$/i;
const PATH_SEGMENT = /^\/([A-Za-z0-9_-]{5,12})$/;

/**
 * A shortener's key is random, so it mixes cases or carries a digit. A short
 * word does neither, which is what keeps mybank.com/login out of this.
 */
function opaqueKey(pathname) {
  const key = PATH_SEGMENT.exec(pathname)?.[1];
  if (!key) return false;
  const mixedCase = /[a-z]/.test(key) && /[A-Z]/.test(key);
  return mixedCase || /\d/.test(key);
}

export function looksShortened(link) {
  try {
    const url = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (SHORTENERS.has(host)) return false; // already named, with its own fact
    return SHORT_HOST.test(host) && opaqueKey(url.pathname) && !url.search;
  } catch {
    return false;
  }
}

/** Ghana's government addresses. Nothing else may call itself one. */
const GOV_DOMAIN = /(?:^|\.)gov\.gh$/i;
const OFFICIAL_CLAIM = /\bofficial\s+(?:traffic\s+)?(?:portal|website|site|page|link|message|notice)\b|\b(?:government|police|customs|court|ministry|dvla|mttd|nrsa)\b/i;
const NEW_SITE_DAYS = 90;
const MAX_AGE_LOOKUPS = 3;
const DAY_MS = 86_400_000;

/** Plain facts about the links, in fixed wording. They change no status or tier. */
async function linkFacts({ domains, pages, ageOf, pageFrozen, text = "" }) {
  const facts = [];
  const add = (fact) => {
    if (!facts.includes(fact)) facts.push(fact);
  };

  if (domains.some((d) => SHORTENERS.has(d))) add(linkFact("shortener"));

  /* The path is the evidence, and only the fetched pages keep it: read out of
   * an image, a link often survives as a bare domain. So the raw text is
   * scanned too — a screenshot is how this family usually arrives. */
  const writtenLinks = String(text).match(/https?:\/\/[^\s<>"')\]]+/gi) || [];
  if ([...pages.map((page) => page.link), ...writtenLinks].some((link) => looksShortened(link))) {
    add(linkFact("shortenerShape"));
  }

  for (const page of pages) {
    const from = normalizeDomain(page.link);
    const to = page.finalUrl ? normalizeDomain(page.finalUrl) : from;
    if (to && to !== from) add(linkFact("redirect", { from, to }));
    if (page.isHttps === false) add(linkFact("noHttps"));
    if (page.hasLoginForm) add(linkFact("login"));
    if (page.hasPaymentForm) add(linkFact("payment"));

    const signals = page.pageSignals || {};
    for (const signal of ["deadControls", "mismatchedLink", "oddLink", "chatLinks", "sameTimes"]) {
      if (signals[signal]) add(linkFact(signal));
    }
    if (signals.timeSignature && page.finalUrl) {
      const hours = await Promise.resolve(pageFrozen(page.finalUrl, signals.timeSignature)).catch(() => null);
      if (hours) add(linkFact("frozenTimes", { hours, unit: hours === 1 ? "hour" : "hours" }));
    }
  }

  const landing = [...new Set([...domains.filter((d) => !SHORTENERS.has(d)), ...pages.map((p) => (p.finalUrl ? normalizeDomain(p.finalUrl) : "")).filter(Boolean)])];

  /* The sign says the message claims to be official. This says where the link
   * actually goes. Neither accuses anyone on its own, and together they are
   * just two facts side by side — which is the whole point: a real DVLA notice
   * links to a .gov.gh address, and the reader can see that this one does not. */
  if (OFFICIAL_CLAIM.test(text) && landing.length > 0 && !landing.some((d) => GOV_DOMAIN.test(d))) {
    add(linkFact("notGovernment", { domain: landing[0] }));
  }

  for (const domain of landing) {
    const ending = WATCHED_ENDINGS.find((e) => domain.endsWith(e));
    if (ending) add(linkFact("ending", { ending }));
  }

  const ages = await Promise.all(landing.slice(0, MAX_AGE_LOOKUPS).map((domain) => Promise.resolve(ageOf(domain)).catch(() => null).then((date) => ({ domain, date }))));
  for (const { domain, date } of ages) {
    if (!date) continue;
    const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS));
    if (days <= NEW_SITE_DAYS) add(linkFact("newSite", { domain, days, unit: days === 1 ? "day" : "days", date: new Date(date).toISOString().slice(0, 10) }));
  }

  return facts;
}

/**
 * Which result leads the reply. An unknown payment detail outranks a licensed name
 * in the same message: "Databank" beside a stranger's number must not read as
 * "this is Databank".
 */
function significance(result, type) {
  if (result.tier === 1) return 6;
  if (result.impersonated) return 5;
  if (!result.match && PAYMENT_TYPES.has(type)) return 4;
  if (!result.match && type === "domain") return 3;
  if (result.match) return 2;
  return 1;
}

function socialCandidate(link) {
  const handle = link.match(/@[\w.-]+/);
  if (/tiktok\.com/.test(link)) return { type: "tiktok_handle", value: handle ? handle[0] : link };
  return { type: "telegram_link", value: link };
}

/** TikTok and Telegram links are never fetched. A person looks at them. */
async function queueForManualReview(links, channel) {
  await Promise.all(
    links.map(async (link) => {
      const { type, value } = socialCandidate(link);
      const valueHash = hashIdentifier(type, normalizeIdentifier(type, value));
      const open = await PublicReport.exists({ "identifiers.valueHash": valueHash, reviewStatus: { $in: ["pending", "under_review"] } });
      if (open) return;
      await PublicReport.create({
        schemeName: "Forwarded link, for review",
        identifiers: [{ type, valueHash }],
        source: channel,
        // A public post's address, so a person can open it. Nothing about the sender.
        evidenceRefs: [`https://${link}`],
      });
    })
  );
}

async function readLinks(links, { scrape, readPage }, notes) {
  const pages = await Promise.all(
    links.map(async (link) => {
      const page = await scrape(link);
      if (page.error) return { error: true, link };
      const ai = await readPage(link, { page }).catch(() => null);
      // The meta description is left out: nobody sees it on the page.
      return {
        link,
        text: [page.title, page.bodyText].filter(Boolean).join(" "),
        ai,
        hiddenAtAi: aimedAtAi(page.hiddenText),
        finalUrl: page.finalUrl,
        isHttps: page.isHttps,
        hasLoginForm: page.hasLoginForm,
        hasPaymentForm: page.hasPaymentForm,
        pageSignals: page.pageSignals,
      };
    })
  );
  if (pages.some((p) => p.error)) notes.push(NOTES.linkUnread);
  return pages.filter((p) => !p.error);
}

export async function checkMessage(input, deps = {}) {
  const { urls = [], image_base64: imageBase64, mime_type: mimeType, recipient, type, channel = "web" } = input;
  const scrape = deps.scrape || scrapeUrl;
  const readPage = deps.readPage || extractFromUrl;
  const readImage = deps.readImage || extractFromImage;
  const ageOf = deps.domainAge || lookUpDomainAge;
  const pageFrozen = deps.pageFrozen || frozenFor;

  const text = cleanText(input.text);
  const notes = [];
  const fromMessage = extract([text, ...urls].join("\n"));

  /* --- Read what was sent ------------------------------------------- */
  const pages = await readLinks(fromMessage.links.slice(0, MAX_LINKS), { scrape, readPage }, notes);

  let image = null;
  if (imageBase64) {
    image = await readImage(imageBase64, mimeType).catch(() => null);
    notes.push(!image || image.error || !image.extracted_text ? NOTES.imageUnread : NOTES.imageRead);
  }

  const readText = [text, ...pages.map((p) => p.text), image?.extracted_text || ""].filter(Boolean).join("\n").slice(0, MAX_READ_TEXT);

  /* --- Work out what to look up ------------------------------------- */
  // Numbers and wallets from pages and images count too. Their links aren't followed.
  const ruleResults = extract(readText);
  let found = { ...fromMessage, numbers: ruleResults.numbers, wallets: ruleResults.wallets };
  found = mergeAiCandidates(found, image, image?.extracted_text);
  for (const page of pages) found = mergeAiCandidates(found, page.ai, page.text);

  const reviewed = await reviewedEntities();
  const named = [...new Set([...findNamesInText(readText, reviewed), ...found.names])];

  const merchants = await Merchant.find({ status: "verified" }).select("legalName").lean();
  const advertisedAs = findNamesInText(readText, merchants.map((m) => ({ name: m.legalName })))[0];
  const skip = (word) => EXACT_MATCH_ONLY.has(normalizeName(word));
  const suggestedName = findLookalikesInText(readText, await reviewedEntities({ fuzzyOnly: true }), { skip })[0] || null;

  // Where a link really lands, so a short link can't hide a listed site.
  const landedOn = pages.map((p) => (p.finalUrl ? normalizeDomain(p.finalUrl) : "")).filter((d) => d && !found.domains.includes(d));

  const candidates = [
    ...(recipient ? [{ type, value: recipient }] : []),
    ...landedOn.map((value) => ({ type: "domain", value })),
    ...found.numbers.map((value) => ({ type: "momo_number", value, advertised: advertisedAs })),
    ...found.wallets.map((value) => ({ type: "wallet", value })),
    ...found.domains.map((value) => ({ type: "domain", value })),
    ...fromMessage.manual_review.map(socialCandidate),
    ...fromMessage.app_ids.map((value) => ({ type: "app_id", value })),
    ...named.map((value) => ({ type: "name", value })),
  ].slice(0, MAX_CANDIDATES);

  if (fromMessage.manual_review.length) {
    notes.push(NOTES.manualReview);
    await queueForManualReview(fromMessage.manual_review, channel);
  }

  /* --- Look each one up, and lead with the most significant ---------- */
  const checks = await Promise.all(
    candidates.map(async (c) => ({
      ...c,
      result: await evaluate({ recipient: c.value, type: c.type, text: readText, advertised_as: c.advertised, audience: "public" }),
    }))
  );

  const ranked = [...checks].sort((a, b) => significance(b.result, b.type) - significance(a.result, a.type));
  let lead = ranked[0];

  if (!lead) {
    lead = { result: await evaluate({ recipient: "", type: "name", text: readText, suggested_name: suggestedName, audience: "public" }) };
  } else if (!lead.result.match && !lead.result.did_you_mean && suggestedName) {
    const value = lead.value;
    lead = { ...lead, result: await evaluate({ recipient: value, type: lead.type, text: readText, suggested_name: suggestedName, audience: "public" }) };
  }

  // Each other finding once, and not the one the reply already leads with.
  const others = ranked
    .slice(1)
    .filter((c) => !c.result.entity || c.result.entity !== lead.result.entity)
    .map((c) => alsoCheckedLine(c.result.entity || c.value, c.result.report.state_sentence));

  const { result } = lead;

  // Signs AI spotted, each proven against what was really read, in fixed wording.
  // Kept apart from the rules' signs, and they change no status, tier or action.
  const aiSigns = [
    ...aiWarningSigns(image, image?.extracted_text, { fromImage: true }),
    ...pages.flatMap((p) => aiWarningSigns(p.ai, p.text)),
  ];
  result.report.ai_warning_signs = [...new Set(aiSigns)].filter((sign) => !result.report.warning_signs.includes(sign));
  if (pages.some((p) => p.hiddenAtAi)) result.report.warning_signs.push(HIDDEN_AI_TEXT_SIGN);

  const directDomain = recipient && ["domain", "url"].includes(type) ? [normalizeDomain(recipient)] : [];
  // The message's own words decide whether the "not a .gov.gh address" fact
  // applies, so the text travels with the links. Text read out of an image
  // counts too: the campaign arrives as a screenshot more often than as text.
  result.report.link_facts = await linkFacts({
    domains: [...new Set([...found.domains, ...directDomain])].filter(Boolean),
    pages,
    ageOf,
    pageFrozen,
    text: `${text || ""} ${image?.extracted_text || ""}`,
  });

  // Set again now every rule-based finding is in. Signs AI spotted don't count.
  result.report.evidence_level = evidenceLevel({
    state: result.state,
    tier: result.tier,
    impersonated: result.impersonated,
    foreignContext: result.foreign_context,
    merchantClaim: result.merchant_claim,
    signCount: result.report.warning_signs.length + result.report.link_facts.length,
  });
  if (aimedAtAi(image?.hidden_text)) result.report.warning_signs.push(HIDDEN_AI_IMAGE_SIGN);
  result.report.also_checked = [...new Set(others)];
  result.report.notes = notes;

  return {
    result,
    identifierHashes: checks.map((c) => c.result.value_hash).filter(Boolean),
    matchedEntityIds: checks.map((c) => c.result.entity_id).filter(Boolean),
    inputType: imageBase64 ? "image" : urls.length ? "url" : lead.type === "momo_number" ? "number" : ["domain", "wallet"].includes(lead.type) ? lead.type : "name",
  };
}
