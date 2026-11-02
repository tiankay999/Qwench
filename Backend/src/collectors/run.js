import crypto from "node:crypto";

import * as cheerio from "cheerio";
import pdf from "pdf-parse/lib/pdf-parse.js";

import { buildIdentifier, slugifyEntity } from "../lib/identifiers.js";
import { safeFetch } from "../lib/safeFetch.js";
import { CollectedNotice, CollectorRun, Entity, Identifier, Record, Source } from "../models/index.js";
import { isRelevant, parseNotice } from "./parse.js";

/**
 * Collects regulators' notices into the review queue. It runs apart from checks, so a
 * slow or broken regulator site can never slow a check.
 *
 * Everything it creates is pending. Pending records are never returned by a check, so
 * nothing goes live until a person approves it.
 */

const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const PAUSE_MS = 1000;
const STALE_AFTER_HOURS = 24;
const FETCH = { timeoutMs: 20_000 };

export const SOURCES = {
  sec: { id: "sec", publisher: "Securities and Exchange Commission, Ghana", api: "https://sec.gov.gh/wp-json/wp/v2/posts" },
  bog: { id: "bog", publisher: "Bank of Ghana", api: "https://www.bog.gov.gh/wp-json/wp/v2/notice" },
};

async function defaultFetchList(source) {
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${source.api}?per_page=${PAGE_SIZE}&page=${page}&_fields=id,date,modified,title,link`;
    const { status, body } = await safeFetch(url, { ...FETCH, accept: "application/json" });
    // WordPress answers 400 past the last page.
    if (status === 400) break;
    if (status !== 200) throw new Error(`List returned ${status}`);
    const batch = JSON.parse(body);
    items.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return items;
}

const defaultFetchPage = async (url) => (await safeFetch(url, FETCH)).body;

async function defaultFetchPdf(url) {
  const { body } = await safeFetch(url, { ...FETCH, accept: "application/pdf", allowType: /pdf|octet-stream/i, asBuffer: true });
  return body;
}

const defaultReadPdf = async (bytes) => (await pdf(bytes)).text;
const defaultWait = () => new Promise((resolve) => setTimeout(resolve, PAUSE_MS));

function pdfLinkIn(html) {
  const $ = cheerio.load(String(html));
  return $('a[href*=".pdf" i]').first().attr("href") || null;
}

/** The notice's own part of a page, without the site's menus. */
function mainHtml(html) {
  const $ = cheerio.load(String(html));
  $("nav, header, footer, aside, script, style, noscript").remove();
  const main = $(".entry-content, .post-content, .elementor-widget-theme-post-content, article, main").first();
  return main.length ? main.html() : $("body").html();
}

/**
 * The same company can be written differently across notices: "VAULTA", then "VAULTA
 * DIGITAL ASSETS LTD". A short name is treated as the same entity only when another
 * entity's name begins with it, and the name is kept as an alias for a person to see.
 */
async function findOrCreateEntity(found, slug, parsed) {
  const exact = await Entity.findOne({ slug });
  if (exact) return exact;

  const pattern = new RegExp(`^${found.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s`, "i");
  const longer = /\s/.test(found.name) ? null : await Entity.findOne({ name: pattern, kind: parsed.kind });
  if (longer) {
    if (!longer.aliases.includes(found.name)) {
      longer.aliases.push(found.name);
      await longer.save();
    }
    return longer;
  }

  return Entity.create({ name: found.name, slug, kind: parsed.kind, aliases: found.aliases, allowFuzzy: false });
}

async function saveCandidates(parsed, item, source, documentUrl) {
  const publishedOn = new Date(item.date);
  const type = parsed.recordType === "sandbox" ? "register" : "notice";

  const sourceDoc =
    (await Source.findOne({ publisher: source.publisher, title: parsed.title })) ||
    (await Source.create({ publisher: source.publisher, title: parsed.title, type, url: item.link, archiveUrl: documentUrl || undefined, publishedOn, isOfficial: true }));

  let created = 0;
  for (const found of parsed.entities) {
    const slug = slugifyEntity(found.name);
    if (!slug) continue;

    const entity = await findOrCreateEntity(found, slug, parsed);

    for (const [idType, value] of [...[found.name, ...found.aliases].map((v) => ["name", v]), ...found.domains.map((v) => ["domain", v])]) {
      const built = buildIdentifier(idType, value, { origin: "notice", allowFuzzy: false });
      if (built.valueHash && !(await Identifier.exists({ entityId: entity._id, type: idType, valueHash: built.valueHash }))) {
        await Identifier.create({ ...built, entityId: entity._id });
      }
    }

    // One queue item per entity, from its newest notice. A later notice adds another.
    const existing = await Record.find({ entityId: entity._id, type: parsed.recordType }).populate("sourceId").lean();
    const covered = existing.some((r) => r.sourceId?.publisher === source.publisher && new Date(r.sourceId.publishedOn) >= publishedOn);
    if (covered) continue;

    await Record.create({
      entityId: entity._id,
      sourceId: sourceDoc._id,
      type: parsed.recordType,
      jurisdiction: "GH",
      quote: parsed.quote || undefined,
      effectiveOn: publishedOn,
      status: "pending",
      capturedBy: `collector:${source.id}`,
    });
    created += 1;
  }
  return created;
}

async function readNotice(item, source, deps) {
  const html = await deps.fetchPage(item.link);
  const documentUrl = pdfLinkIn(html);
  const document = documentUrl ? await deps.fetchPdf(documentUrl) : null;
  const pdfText = document ? await deps.readPdf(document).catch(() => "") : "";

  const content = mainHtml(html);
  const parsed = parseNotice({ collector: source.id, title: item.title.rendered, html: content, text: pdfText || cheerio.load(content || "").text() });
  const contentHash = crypto.createHash("sha256").update(document || html).digest("hex");
  return { parsed, documentUrl, document, contentHash };
}

async function collectSource(source, deps, report) {
  const items = (await deps.fetchList(source)).filter((item) => isRelevant(source.id, item.title.rendered));
  // Newest first, so each entity's record comes from its latest notice.
  items.sort((a, b) => new Date(b.date) - new Date(a.date));

  for (const item of items) {
    const externalId = String(item.id);
    const known = await CollectedNotice.findOne({ collector: source.id, externalId });
    const modifiedOn = new Date(item.modified || item.date);
    if (known && known.modifiedOn && known.modifiedOn >= modifiedOn) continue;

    try {
      const { parsed, documentUrl, document, contentHash } = await readNotice(item, source, deps);

      if (known && known.contentHash === contentHash) {
        known.modifiedOn = modifiedOn;
        await known.save();
        await deps.wait();
        continue;
      }

      const created = await saveCandidates(parsed, item, source, documentUrl);
      report.candidates += created;

      const fields = {
        title: parsed.title,
        url: item.link,
        documentUrl,
        publishedOn: new Date(item.date),
        modifiedOn,
        contentHash,
        document,
        entitiesFound: parsed.entities.length,
        websitesForPerson: parsed.websitesForPerson,
      };

      if (known) {
        // A regulator changed a published notice. What was approved stays as it is, and
        // a person looks at what changed.
        known.set({ ...fields, status: "needs_person", note: "This notice changed after it was first read, so a person needs to compare it." });
        await known.save();
        report.changedNotices += 1;
      } else {
        await CollectedNotice.create({ ...fields, collector: source.id, externalId, status: parsed.note ? "needs_person" : "parsed", note: parsed.note || undefined });
        report.newNotices += 1;
        if (parsed.note) report.needsPerson += 1;
      }
    } catch {
      // Left unrecorded, so the next run tries it again.
      report.failed += 1;
    }
    await deps.wait();
  }
}

export async function collect(ids = Object.keys(SOURCES), overrides = {}) {
  const deps = { fetchList: defaultFetchList, fetchPage: defaultFetchPage, fetchPdf: defaultFetchPdf, readPdf: defaultReadPdf, wait: defaultWait, ...overrides };
  const results = {};

  for (const id of ids) {
    const report = { newNotices: 0, changedNotices: 0, needsPerson: 0, candidates: 0, failed: 0 };
    const now = new Date();
    try {
      await collectSource(SOURCES[id], deps, report);
      await CollectorRun.updateOne({ collector: id }, { $set: { lastRunAt: now, lastSuccessAt: now, lastError: null, lastNewNotices: report.newNotices } }, { upsert: true });
    } catch (err) {
      report.error = err.name;
      await CollectorRun.updateOne({ collector: id }, { $set: { lastRunAt: now, lastError: err.name } }, { upsert: true });
    }
    results[id] = report;
  }
  return results;
}

/** For reviewers: is each source working, and how much is waiting? */
export async function collectorStatus(now = new Date()) {
  const runs = await CollectorRun.find({}).lean();
  const byId = new Map(runs.map((r) => [r.collector, r]));

  return {
    collectors: Object.values(SOURCES).map((source) => {
      const run = byId.get(source.id);
      const last = run?.lastSuccessAt;
      return {
        collector: source.id,
        publisher: source.publisher,
        last_run_at: run?.lastRunAt || null,
        last_success_at: last || null,
        last_error: run?.lastError || null,
        stale: !last || now - last > STALE_AFTER_HOURS * 3_600_000,
      };
    }),
    pending_records: await Record.countDocuments({ status: "pending" }),
    notices_needing_a_person: await CollectedNotice.countDocuments({ status: "needs_person" }),
  };
}

let timer = null;
let running = false;

/** Runs on a timer inside the server when COLLECTORS_ENABLED=true. */
export function startCollectors(hours = Number(process.env.COLLECT_EVERY_HOURS) || 1) {
  if (timer) return;
  const tick = async () => {
    if (running) return;
    running = true;
    await collect().catch((err) => console.error(`[collect] run failed: ${err.name}`));
    running = false;
  };
  tick();
  timer = setInterval(tick, hours * 3_600_000);
  timer.unref();
}
