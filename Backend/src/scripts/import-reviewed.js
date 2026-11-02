import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import { requireSecrets } from "../config/env.js";
import { IDENTIFIER_TYPES, buildIdentifier, normalizeName, slugifyEntity } from "../lib/identifiers.js";
import { ENTITY_KINDS, Entity, Identifier, RECORD_TYPES, Record, Source, recordAudit } from "../models/index.js";

/**
 * Loads reviewed records from src/data/reviewed/*.json into the database.
 *
 * Each file holds one row or an array of rows, in the format in
 * docs/spec/05-data-lead-workplan.md. A row with anything missing is rejected
 * with a reason: a missing date, link or quote is never guessed. Running it again
 * updates what changed and adds no duplicates.
 *
 *   node src/scripts/import-reviewed.js
 *   node src/scripts/import-reviewed.js --dry-run
 *   node src/scripts/import-reviewed.js --dir path/to/files
 */

const DEFAULT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../data/reviewed");

// The no-record test case. A record for this name would make that test meaningless.
const MUST_NEVER_HAVE_A_RECORD = "goldwave";

const SOURCE_TYPE_FOR = {
  warning: "notice",
  foreign_alert: "notice",
  sanction: "sanctions_list",
  licence: "register",
  sandbox: "register",
  registration: "register",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const isText = (v) => typeof v === "string" && v.trim() !== "";
const isDate = (v) => isText(v) && ISO_DATE.test(v) && !Number.isNaN(new Date(v).getTime());

function isHttpUrl(v) {
  try {
    return ["http:", "https:"].includes(new URL(v).protocol);
  } catch {
    return false;
  }
}

/** Every reason a row can't be loaded. An empty list means it can. */
export function validateRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return ["row is not an object"];

  const reasons = [];
  const need = (ok, reason) => {
    if (!ok) reasons.push(reason);
  };

  need(isText(row.name), "name is missing");
  need(ENTITY_KINDS.includes(row.kind), `kind must be one of: ${ENTITY_KINDS.join(", ")}`);
  need(RECORD_TYPES.includes(row.recordType), `recordType must be one of: ${RECORD_TYPES.join(", ")}`);
  need(isText(row.jurisdiction), "jurisdiction is missing");
  need(isText(row.quote), "quote is missing");
  need(isDate(row.effectiveOn), "effectiveOn is missing or not a YYYY-MM-DD date");
  need(row.endsOn === null || row.endsOn === undefined || isDate(row.endsOn), "endsOn is not a YYYY-MM-DD date");
  need(row.aliases === undefined || Array.isArray(row.aliases), "aliases must be a list");
  need(row.allowFuzzy === undefined || typeof row.allowFuzzy === "boolean", "allowFuzzy must be true or false");
  need(row.recordType !== "licence" || isText(row.licenseType), "licenseType is missing on a licence");

  need(isText(row.source?.publisher), "source.publisher is missing");
  need(isText(row.source?.title), "source.title is missing");
  need(isHttpUrl(row.source?.url), "source.url is missing or not a link");
  need(isDate(row.source?.publishedOn), "source.publishedOn is missing or not a YYYY-MM-DD date");

  need(isText(row.capturedBy), "capturedBy is missing");
  need(isText(row.reviewedBy), "reviewedBy is missing");
  if (isText(row.capturedBy) && isText(row.reviewedBy)) {
    need(row.capturedBy.trim().toLowerCase() !== row.reviewedBy.trim().toLowerCase(), "reviewedBy must be a different person from capturedBy");
  }

  if (isText(row.name)) {
    need(!normalizeName(row.name).replace(/\s/g, "").includes(MUST_NEVER_HAVE_A_RECORD), "GoldWave is the no-record test and must never have a record");
  }

  if (row.identifiers !== undefined && !Array.isArray(row.identifiers)) {
    reasons.push("identifiers must be a list");
  } else {
    (row.identifiers || []).forEach((id, i) => {
      if (!IDENTIFIER_TYPES.includes(id?.type)) return reasons.push(`identifiers[${i}].type is not a known type`);
      if (!isText(id.raw)) return reasons.push(`identifiers[${i}].raw is missing`);
      if (id.type === "momo_number" && !/^\+233\d{9}$/.test(buildIdentifier("momo_number", id.raw).normalized)) {
        reasons.push(`identifiers[${i}] is not a +233 number`);
      }
      return undefined;
    });
  }

  return reasons;
}

function sameDate(a, b) {
  return (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
}

/** Upsert the source. Returns the document and whether anything changed. */
async function upsertSource(row) {
  const { publisher, title, url, publishedOn } = row.source;
  const existing = await Source.findOne({ publisher, title });

  if (!existing) {
    const created = await Source.create({ publisher, title, url, publishedOn: new Date(publishedOn), type: SOURCE_TYPE_FOR[row.recordType], isOfficial: true });
    return { doc: created, changed: true };
  }

  const changed = existing.url !== url || !sameDate(existing.publishedOn, publishedOn);
  if (changed) {
    existing.set({ url, publishedOn: new Date(publishedOn) });
    await existing.save();
  }
  return { doc: existing, changed };
}

async function upsertEntity(row) {
  const slug = slugifyEntity(row.name);
  const aliases = row.aliases || [];
  const allowFuzzy = row.allowFuzzy === true;
  const existing = await Entity.findOne({ slug });

  if (!existing) {
    return { doc: await Entity.create({ name: row.name, slug, kind: row.kind, aliases, allowFuzzy }), changed: true };
  }
  if (existing.isDemo) throw new Error(`"${row.name}" already exists as demo data`);

  const changed = existing.name !== row.name || existing.kind !== row.kind || existing.allowFuzzy !== allowFuzzy || JSON.stringify([...existing.aliases]) !== JSON.stringify(aliases);
  if (changed) {
    existing.set({ name: row.name, kind: row.kind, aliases, allowFuzzy });
    await existing.save();
  }
  return { doc: existing, changed };
}

/** The name, every alias and every listed identifier, all published in the notice. */
async function upsertIdentifiers(row, entity) {
  const wanted = [
    ...[row.name, ...(row.aliases || [])].map((raw) => ({ type: "name", raw })),
    ...(row.identifiers || []),
  ];

  let changed = false;
  for (const { type, raw } of wanted) {
    const built = buildIdentifier(type, raw, { origin: "notice" });
    if (!built.valueHash) continue;
    if (built.allowFuzzy && row.allowFuzzy !== true) built.allowFuzzy = false;

    const exists = await Identifier.findOne({ entityId: entity._id, type, valueHash: built.valueHash });
    if (exists) continue;
    await Identifier.create({ ...built, entityId: entity._id });
    changed = true;
  }
  return changed;
}

function desiredRecord(row) {
  const endsOn = row.endsOn ? new Date(row.endsOn) : null;
  return {
    jurisdiction: row.jurisdiction.trim().toUpperCase(),
    licenseType: row.licenseType || undefined,
    quote: row.quote.trim(),
    effectiveOn: new Date(row.effectiveOn),
    endsOn,
    status: endsOn && endsOn < new Date() ? "expired" : "active",
    capturedBy: row.capturedBy.trim(),
    reviewedBy: row.reviewedBy.trim(),
  };
}

async function upsertRecord(row, entity, source) {
  const key = { entityId: entity._id, sourceId: source._id, type: row.recordType };
  const want = desiredRecord(row);
  const existing = await Record.findOne(key);

  if (!existing) {
    const created = await Record.create({ ...key, ...want });
    await recordAudit({ actor: `import:${want.reviewedBy}`, action: "record.import", target: `Record:${created._id}`, after: { status: want.status, reviewedBy: want.reviewedBy } });
    return true;
  }

  if (existing.status === "withdrawn") throw new Error("the record was withdrawn, so a person must decide whether it comes back");

  const before = { status: existing.status, quote: existing.quote, reviewedBy: existing.reviewedBy };
  const changed =
    existing.jurisdiction !== want.jurisdiction ||
    (existing.licenseType || undefined) !== want.licenseType ||
    existing.quote !== want.quote ||
    !sameDate(existing.effectiveOn, want.effectiveOn) ||
    !sameDate(existing.endsOn, want.endsOn) ||
    existing.status !== want.status ||
    existing.capturedBy !== want.capturedBy ||
    existing.reviewedBy !== want.reviewedBy;

  if (!changed) return false;

  existing.set(want);
  await existing.save();
  await recordAudit({ actor: `import:${want.reviewedBy}`, action: "record.import", target: `Record:${existing._id}`, before, after: { status: want.status, quote: want.quote, reviewedBy: want.reviewedBy } });
  return true;
}

/** Read every row in the folder. A file that won't parse is reported, not skipped silently. */
function readRows(dir) {
  const rows = [];
  const rejected = [];
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];

  for (const file of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      (Array.isArray(parsed) ? parsed : [parsed]).forEach((row, i) => rows.push({ file, index: i, row }));
    } catch {
      rejected.push({ file, name: "(whole file)", reasons: ["not valid JSON"] });
    }
  }
  return { files, rows, rejected };
}

export async function importReviewed({ dir = DEFAULT_DIR, dryRun = false } = {}) {
  const { files, rows, rejected } = readRows(dir);
  const report = { files: files.length, added: [], changed: [], unchanged: [], rejected };

  for (const { file, row } of rows) {
    const name = row?.name || "(no name)";
    const reasons = validateRow(row);
    if (reasons.length) {
      report.rejected.push({ file, name, reasons });
      continue;
    }
    if (dryRun) {
      report.unchanged.push(name);
      continue;
    }

    try {
      const isNew = !(await Entity.exists({ slug: slugifyEntity(row.name) }));
      const source = await upsertSource(row);
      const entity = await upsertEntity(row);
      const identifiers = await upsertIdentifiers(row, entity.doc);
      const record = await upsertRecord(row, entity.doc, source.doc);

      if (isNew) report.added.push(name);
      else if (source.changed || entity.changed || identifiers || record) report.changed.push(name);
      else report.unchanged.push(name);
    } catch (err) {
      report.rejected.push({ file, name, reasons: [err.message] });
    }
  }

  return report;
}

function printReport(report, dryRun) {
  console.log("");
  console.log(`  ${dryRun ? "DRY RUN: checked" : "Imported from"} ${report.files} file(s)`);
  if (!report.files) console.log("  No reviewed files yet, so real data is still needed from the data lead.");
  if (!dryRun) {
    console.log(`  Added:     ${report.added.length}`);
    report.added.forEach((n) => console.log(`    + ${n}`));
    console.log(`  Changed:   ${report.changed.length}`);
    report.changed.forEach((n) => console.log(`    ~ ${n}`));
    console.log(`  Unchanged: ${report.unchanged.length}`);
  } else {
    console.log(`  Valid:     ${report.unchanged.length}`);
  }
  console.log(`  Rejected:  ${report.rejected.length}`);
  for (const { file, name, reasons } of report.rejected) {
    console.log(`    x ${name} (${file})`);
    reasons.forEach((r) => console.log(`        ${r}`));
  }
  console.log("");
}

if (process.argv[1]?.endsWith("import-reviewed.js")) {
  requireSecrets();
  await connectDB();
  const dryRun = process.argv.includes("--dry-run");
  const dirFlag = process.argv.indexOf("--dir");
  const report = await importReviewed({ dryRun, dir: dirFlag !== -1 ? process.argv[dirFlag + 1] : DEFAULT_DIR });
  printReport(report, dryRun);
  await mongoose.disconnect();
  process.exit(0);
}
