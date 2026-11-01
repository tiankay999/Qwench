import "dotenv/config";

import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import { requireSecrets } from "../config/env.js";
import { buildIdentifier, hourBucket, slugifyEntity } from "../lib/identifiers.js";
import {
  Entity,
  Identifier,
  Check,
  LegacyCheck,
  PublicReport,
  Record,
  Source,
  Investment,
  Report,
} from "../models/index.js";

/**
 * Moves the old collections into the new data model.
 *
 *   Investment  -> Entity + Identifier + Record (+ a Source per publisher)
 *   Report      -> PublicReport
 *   checks      -> check_events, with the raw query dropped
 *
 * Idempotent: re-running updates rather than duplicating. Nothing is deleted
 * from the old collections, so the live risk engine keeps working and this can
 * be run repeatedly while the cutover is prepared.
 *
 *   node src/scripts/migrateOldData.js            # migrate
 *   node src/scripts/migrateOldData.js --dry-run  # report only
 */

const DRY_RUN = process.argv.includes("--dry-run");
const CAPTURED_BY = "migration:legacy-import";

const stats = {
  sources: 0,
  entities: 0,
  identifiers: 0,
  records: 0,
  publicReports: 0,
  checks: 0,
  skipped: [],
};

/** Old status -> new (record type, entity kind). */
const STATUS_MAP = {
  licensed: { recordType: "licence", kind: "company" },
  sandbox: { recordType: "sandbox", kind: "platform" },
  blacklisted: { recordType: "warning", kind: "platform" },
  revoked: { recordType: "warning", kind: "company" },
  authority: { recordType: "registration", kind: "authority" },
};

/** One Source per publisher named in the old data. */
async function sourceFor(publisher, isOfficial = true) {
  const title = `${publisher} — legacy register import`;

  if (DRY_RUN) return { _id: new mongoose.Types.ObjectId(), title };

  const existing = await Source.findOne({ publisher, title });
  if (existing) return existing;

  stats.sources += 1;
  return Source.create({
    publisher,
    type: "register",
    title,
    publishedOn: new Date("2026-01-01"),
    retrievedAt: new Date(),
    isOfficial,
    url: publisher.includes("SEC") ? "https://sec.gov.gh" : undefined,
  });
}

async function migrateInvestments() {
  // Entries the risk engine cached for itself are not register facts.
  const docs = await Investment.find({ status: { $ne: "unknown" } }).lean();
  console.log(`\n[migrate] ${docs.length} register entities to move`);

  for (const old of docs) {
    const mapping = STATUS_MAP[old.status];
    if (!mapping) {
      stats.skipped.push(`${old.name} (unmapped status "${old.status}")`);
      continue;
    }

    const slug = slugifyEntity(old.name);
    if (DRY_RUN) {
      stats.entities += 1;
      stats.identifiers += 1 + (old.aliases?.length || 0);
      stats.records += 1;
      continue;
    }

    const entity = await Entity.findOneAndUpdate(
      { slug },
      {
        $set: {
          name: old.name,
          slug,
          kind: old.category === "crypto" ? "token" : mapping.kind,
          country: "GH",
          aliases: old.aliases || [],
          description: old.redFlags?.length ? old.redFlags.join(" · ") : undefined,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    stats.entities += 1;

    // The name itself, plus every alias, becomes a matchable identifier.
    for (const label of [old.name, ...(old.aliases || [])]) {
      if (!label) continue;
      const built = buildIdentifier("name", label, { origin: "legacy register import" });
      if (!built.valueHash) continue;

      await Identifier.findOneAndUpdate(
        { entityId: entity._id, type: "name", valueHash: built.valueHash },
        { $set: { ...built, entityId: entity._id, status: "active" } },
        { upsert: true, setDefaultsOnInsert: true }
      );
      stats.identifiers += 1;
    }

    const source = await sourceFor(old.source || "SEC Ghana");

    // Imported records land as under_review, never active: four-eyes means a
    // human still has to sign each one off before it can drive a verdict.
    await Record.findOneAndUpdate(
      { entityId: entity._id, sourceId: source._id, type: mapping.recordType },
      {
        $set: {
          entityId: entity._id,
          sourceId: source._id,
          type: mapping.recordType,
          jurisdiction: "GH",
          licenseType: old.licenseType || undefined,
          quote: old.redFlags?.[0] || undefined,
          effectiveOn: old.dateAdded || old.createdAt || undefined,
          status: "under_review",
          capturedBy: CAPTURED_BY,
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    stats.records += 1;
  }
}

async function migrateReports() {
  const docs = await Report.find({}).lean();
  console.log(`[migrate] ${docs.length} public reports to move`);

  for (const old of docs) {
    if (DRY_RUN) {
      stats.publicReports += 1;
      continue;
    }

    const identifiers = [];
    const built = buildIdentifier("name", old.schemeName);
    if (built.valueHash) identifiers.push({ type: "name", valueHash: built.valueHash });

    const source = ["whatsapp", "telegram", "web"].includes(old.source) ? old.source : "whatsapp";

    await PublicReport.findOneAndUpdate(
      { legacyId: old._id },
      {
        $set: {
          legacyId: old._id,
          schemeName: old.schemeName,
          identifiers,
          source,
          // The old description is the reporter's own words; it is evidence,
          // not an identifier, so it carries over as an evidence reference.
          evidenceRefs: old.description ? [old.description.slice(0, 500)] : [],
          reviewStatus: mapReviewStatus(old.status),
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    stats.publicReports += 1;
  }
}

function mapReviewStatus(old) {
  switch (old) {
    case "investigating":
      return "under_review";
    case "confirmed":
      return "confirmed";
    case "resolved":
      return "dismissed";
    default:
      return "pending";
  }
}

async function migrateChecks() {
  const docs = await LegacyCheck.find({}).lean();
  console.log(`[migrate] ${docs.length} checks to move`);

  for (const old of docs) {
    if (DRY_RUN) {
      stats.checks += 1;
      continue;
    }

    // The old row stored the raw query. It is hashed here and the text is
    // dropped — the new model exists precisely so that text is not retained.
    const built = buildIdentifier("name", old.query || "");
    const when = old.createdAt || old.timestamp || new Date();

    const matched = await Entity.findOne({ slug: slugifyEntity(old.query || "") })
      .select("_id")
      .lean();

    await Check.findOneAndUpdate(
      { legacyId: old._id },
      {
        $set: {
          legacyId: old._id,
          hourBucket: hourBucket(new Date(when)),
          channel: ["whatsapp", "telegram", "web", "api"].includes(old.channel) ? old.channel : "whatsapp",
          inputType: "name",
          identifierHashes: built.valueHash ? [built.valueHash] : [],
          matchedEntityIds: matched ? [matched._id] : [],
          state: mapState(old.result?.status),
          flags: old.result?.redFlags?.slice(0, 6) || [],
          outcome: mapOutcome(old.result?.riskVerdict),
          // No sender hash exists in the old data, and none is invented.
          senderHash: null,
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
    stats.checks += 1;
  }
}

function mapState(status) {
  switch (status) {
    case "blacklisted":
    case "revoked":
      return "named_in_notice";
    case "licensed":
      return "licensed";
    case "sandbox":
      return "sandbox";
    case "authority":
      return "registered";
    default:
      return "no_record";
  }
}

function mapOutcome(verdict) {
  switch (verdict) {
    case "CRITICAL":
    case "HIGH":
      return "warn";
    case "MEDIUM":
      return "warn_or_confirmation_call";
    case "LOW":
      return "none";
    default:
      return "none";
  }
}

async function main() {
  requireSecrets();
  await connectDB();

  console.log("");
  console.log(DRY_RUN ? "  🔍 DRY RUN — nothing will be written" : "  📦 Migrating legacy data into the new model");

  await migrateInvestments();
  await migrateReports();
  await migrateChecks();

  console.log("");
  console.log("  Summary");
  console.log(`    sources        ${stats.sources}`);
  console.log(`    entities       ${stats.entities}`);
  console.log(`    identifiers    ${stats.identifiers}`);
  console.log(`    records        ${stats.records}  (all under_review — four-eyes sign-off required)`);
  console.log(`    publicReports  ${stats.publicReports}`);
  console.log(`    checks         ${stats.checks}  (raw query text dropped)`);

  if (stats.skipped.length) {
    console.log("");
    console.log(`  Skipped ${stats.skipped.length}:`);
    stats.skipped.slice(0, 10).forEach((s) => console.log(`    - ${s}`));
  }

  console.log("");
  console.log("  Old collections were not touched. The live risk engine still reads them.");
  console.log("");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("[migrate] failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
