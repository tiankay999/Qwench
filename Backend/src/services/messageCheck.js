import { extract, mergeAiCandidates } from "../engine/extract.js";
import { NOTES, alsoCheckedLine } from "../engine/report.js";
import { EXACT_MATCH_ONLY, hashIdentifier, normalizeIdentifier, normalizeName } from "../lib/identifiers.js";
import { Merchant, PublicReport } from "../models/index.js";
import { extractFromImage, extractFromUrl } from "./aiExtractor.js";
import { evaluate, reviewedEntities } from "./evidenceEngine.js";
import { findLookalikesInText, findNamesInText } from "./nameVerifier.js";
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
      if (page.error) return { error: true };
      const ai = await readPage(link, { page }).catch(() => null);
      return { text: [page.title, page.metaDescription, page.bodyText].filter(Boolean).join(" "), ai };
    })
  );
  if (pages.some((p) => p.error)) notes.push(NOTES.linkUnread);
  return pages.filter((p) => !p.error);
}

export async function checkMessage(input, deps = {}) {
  const { text = "", urls = [], image_base64: imageBase64, mime_type: mimeType, recipient, type, channel = "web" } = input;
  const scrape = deps.scrape || scrapeUrl;
  const readPage = deps.readPage || extractFromUrl;
  const readImage = deps.readImage || extractFromImage;

  const notes = [];
  const fromMessage = extract([text, ...urls].join("\n"));

  /* --- Read what was sent ------------------------------------------- */
  const pages = await readLinks(fromMessage.links.slice(0, MAX_LINKS), { scrape, readPage }, notes);

  let image = null;
  if (imageBase64) {
    image = await readImage(imageBase64, mimeType).catch(() => null);
    if (!image || image.error || !image.extracted_text) notes.push(NOTES.imageUnread);
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

  const candidates = [
    ...(recipient ? [{ type, value: recipient }] : []),
    ...found.numbers.map((value) => ({ type: "momo_number", value, advertised: advertisedAs })),
    ...found.wallets.map((value) => ({ type: "wallet", value })),
    ...found.domains.map((value) => ({ type: "domain", value })),
    ...fromMessage.manual_review.map(socialCandidate),
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

  const others = ranked.slice(1).map((c) => {
    const label = c.result.entity || c.value;
    return alsoCheckedLine(label, c.result.report.state_sentence);
  });

  const { result } = lead;
  result.report.also_checked = others;
  result.report.notes = notes;

  return {
    result,
    identifierHashes: checks.map((c) => c.result.value_hash).filter(Boolean),
    matchedEntityIds: checks.map((c) => c.result.entity_id).filter(Boolean),
    inputType: imageBase64 ? "image" : urls.length ? "url" : lead.type === "momo_number" ? "number" : ["domain", "wallet"].includes(lead.type) ? lead.type : "name",
  };
}
