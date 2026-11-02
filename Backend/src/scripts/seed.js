import "dotenv/config";

import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import { requireSecrets } from "../config/env.js";
import {
  AUTHORITIES,
  DUAL_SOURCE_CASES,
  HISTORICAL_SCAMS,
  IMPERSONATION_CASES,
  IMPERSONATION_RELATIONS,
  LICENSED_ENTITIES,
  ORGANISATIONS,
  PROTECTED_COMPANIES,
  SANDBOX_PARTICIPANTS,
  SANDBOX_WINDOW,
  SEC_BLACKLISTED_2025,
  SEC_EOCO_WARNED,
  SOURCES,
} from "../data/register.js";
import { buildIdentifier, normalizeName } from "../lib/identifiers.js";
import { Entity, Identifier, Organization, Record, Relation, Source } from "../models/index.js";

/**
 * Populates sources, entities, identifiers, records, relations and
 * organisations from the published register in src/data/register.js.
 *
 * Idempotent — every write is an upsert keyed on something stable, so running
 * it repeatedly updates rather than duplicates.
 *
 *   node src/scripts/seed.js
 *   node src/scripts/seed.js --dry-run
 *   node src/scripts/seed.js --prune-legacy   # also remove superseded import rows
 */

const DRY_RUN = process.argv.includes("--dry-run");
const PRUNE_LEGACY = process.argv.includes("--prune-legacy");

const CAPTURED_BY = "seed-admin";
const REVIEWED_BY = "seed-reviewer";

const stats = { sources: 0, entities: 0, identifiers: 0, records: 0, relations: 0, organisations: 0, pruned: 0 };
const warnings = [];

/* ------------------------------------------------------------------ *
 * Building blocks
 * ------------------------------------------------------------------ */

async function seedSources() {
  const map = {};
  for (const src of SOURCES) {
    if (DRY_RUN) {
      map[src.key] = { _id: new mongoose.Types.ObjectId(), publisher: src.publisher, title: src.title };
      stats.sources += 1;
      continue;
    }

    const doc = await Source.findOneAndUpdate(
      { publisher: src.publisher, title: src.title },
      {
        $set: {
          publisher: src.publisher,
          type: src.type,
          title: src.title,
          url: src.url,
          publishedOn: new Date(src.publishedOn),
          isOfficial: src.isOfficial,
          retrievedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    map[src.key] = doc;
    stats.sources += 1;
  }
  return map;
}

async function seedEntity(entity) {
  if (DRY_RUN) {
    stats.entities += 1;
    stats.identifiers += 1 + (entity.aliases?.length || 0);
    return { _id: new mongoose.Types.ObjectId(), name: entity.name, slug: entity.slug };
  }

  const doc = await Entity.findOneAndUpdate(
    { slug: entity.slug },
    {
      $set: {
        name: entity.name,
        slug: entity.slug,
        kind: entity.kind,
        country: entity.country || "GH",
        aliases: entity.aliases || [],
        isActive: true,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  stats.entities += 1;

  await seedIdentifiers(entity, doc);
  return doc;
}

async function seedIdentifiers(entity, entityDoc) {
  for (const label of [entity.name, ...(entity.aliases || [])]) {
    if (!label) continue;

    const built = buildIdentifier("name", label, { origin: entity.protectedName && !entity.sourceKey ? "review" : "notice" });
    if (!built.valueHash) continue;

    // A protected name is never fuzzy-matched, so a real brand cannot be
    // dragged into a notice by a near miss. buildIdentifier already enforces
    // this for the known names; the flag covers the rest.
    if (entity.protectedName) built.allowFuzzy = false;

    // Written through a document save, not a query update: the model refuses
    // query updates to readable values so a sensitive number can never be
    // written back in the clear by a path that skips the hook.
    let doc = await Identifier.findOne({ entityId: entityDoc._id, type: "name", valueHash: built.valueHash });
    if (!doc) doc = new Identifier({ entityId: entityDoc._id, type: "name" });

    doc.set({ ...built, entityId: entityDoc._id, status: "active" });
    await doc.save();
    stats.identifiers += 1;
  }
}

/**
 * Records are written through a document save, not findOneAndUpdate, so the
 * four-eyes hook on the model actually runs. A query update bypasses document
 * middleware, which would let an unreviewed record go active unnoticed.
 */
async function seedRecord(entityId, source, type, { licenseType, effectiveOn, endsOn, quote } = {}) {
  const sourceId = source._id;
  if (DRY_RUN) {
    stats.records += 1;
    return;
  }

  let doc = await Record.findOne({ entityId, sourceId, type });
  if (!doc) doc = new Record({ entityId, sourceId, type });

  doc.set({
    entityId,
    sourceId,
    type,
    jurisdiction: "GH",
    licenseType: licenseType || undefined,
    quote: quote || provenanceFor(type, source, licenseType),
    effectiveOn: effectiveOn || undefined,
    endsOn: endsOn || undefined,
    status: "active",
    capturedBy: CAPTURED_BY,
    reviewedBy: REVIEWED_BY,
    reviewedAt: new Date(),
  });

  await doc.save();
  stats.records += 1;

  // A sandbox place is provisional. If the window has already closed, calling
  // it "sandbox" today would present a lapsed approval as current.
  if (!quote) stats.pendingQuotes = (stats.pendingQuotes || 0) + 1;

  if (type === "sandbox" && endsOn && endsOn < new Date()) {
    warnings.push(
      `the sandbox window in register.js ran to ${endsOn.toISOString().split("T")[0]}, which has passed. ` +
        `Those approvals are treated as lapsed, so participants resolve to "no record" rather than "sandbox". ` +
        `Set SANDBOX_WINDOW to the current period, or confirm the sandbox has ended.`
    );
  }
}

/**
 * Provenance for a record, used where the notice's exact wording has not been
 * transcribed yet.
 *
 * These are deliberately NOT presented as quotations. Inventing a sentence and
 * attributing it to SEC Ghana would be manufacturing the very evidence this
 * system exists to verify, so each line states only what is already known from
 * the source's title and type, and says outright that the wording is pending.
 */
function provenanceFor(type, source, licenseType) {
  const cite = `${source.publisher}, "${source.title}"`;

  switch (type) {
    case "warning":
      return `Named by ${cite}. Verbatim wording not yet transcribed from the notice — see the source URL.`;
    case "licence":
      return `Listed by ${cite}${licenseType ? ` as a ${licenseType}` : ""}. Verbatim wording not yet transcribed.`;
    case "sandbox":
      return `Listed by ${cite} as a provisional virtual asset sandbox participant. Verbatim wording not yet transcribed.`;
    case "registration":
      return `Recorded by ${cite} as a Ghanaian regulator or market infrastructure body.`;
    default:
      return `Recorded by ${cite}. Verbatim wording not yet transcribed.`;
  }
}

async function seedGroup(entities, type, source, extra = {}) {
  for (const entity of entities) {
    const doc = await seedEntity(entity);
    await seedRecord(doc._id, source, type, { licenseType: entity.licenseType, ...extra });
  }
}

async function seedRelations() {
  for (const pair of IMPERSONATION_RELATIONS) {
    if (DRY_RUN) {
      stats.relations += 1;
      continue;
    }

    const [from, to] = await Promise.all([Entity.findOne({ slug: pair.from }), Entity.findOne({ slug: pair.to })]);
    if (!from || !to) {
      warnings.push(`relation skipped: ${pair.from} -> ${pair.to} (entity missing)`);
      continue;
    }

    const existing = await Relation.findOne({ fromEntity: from._id, toEntity: to._id, type: pair.type });
    const doc = existing || new Relation({ fromEntity: from._id, toEntity: to._id, type: pair.type });
    // An active impersonation is published, so it carries the same four-eyes
    // trail as a record: a named capturer and a different named reviewer.
    doc.set({
      status: "active",
      capturedBy: CAPTURED_BY,
      reviewedBy: REVIEWED_BY,
      reviewedAt: new Date(),
      notes: "Seeded — shares a name with a real company",
    });

    try {
      // Saved as a document so the direction rule runs: a licensed entity or
      // an authority can never be recorded as the impersonator.
      await doc.save();
      stats.relations += 1;
    } catch (err) {
      warnings.push(`relation rejected: ${pair.from} -> ${pair.to}: ${err.message}`);
    }
  }
}

async function seedOrganisations() {
  for (const org of ORGANISATIONS) {
    if (DRY_RUN) {
      stats.organisations += 1;
      continue;
    }
    await Organization.findOneAndUpdate({ name: org.name }, { $set: org }, { upsert: true, setDefaultsOnInsert: true });
    stats.organisations += 1;
  }
}

const ALL_GROUPS = [
  AUTHORITIES,
  SEC_BLACKLISTED_2025,
  SEC_EOCO_WARNED,
  HISTORICAL_SCAMS,
  LICENSED_ENTITIES,
  SANDBOX_PARTICIPANTS,
  PROTECTED_COMPANIES,
  DUAL_SOURCE_CASES,
  IMPERSONATION_CASES,
];

/**
 * The legacy importer created entities under long slugs
 * ("menzgold-ghana-limited"). This register now owns those names under short
 * canonical slugs, so those rows are duplicates.
 *
 * Only rows captured by the importer AND covered by a name in this register
 * are removed. Anything the register does not list — the regulators
 * themselves, for instance — is left alone.
 */
/** "Quant Vest Stock Exchange (QVSE)" -> "quant vest stock exchange" */
function bareName(name) {
  return normalizeName(String(name).replace(/([^)]*)/g, " ").replace(/[/]/g, " "));
}

async function pruneLegacyDuplicates() {
  const seededNames = new Set();
  const seededSlugs = new Set();

  for (const group of ALL_GROUPS) {
    for (const e of group) {
      seededSlugs.add(e.slug);
      seededNames.add(normalizeName(e.name));
      seededNames.add(bareName(e.name));
      (e.aliases || []).forEach((a) => {
        seededNames.add(normalizeName(a));
        seededNames.add(bareName(a));
      });
    }
  }

  // 1. Where the seed now owns an entity, its import-era records are stale:
  //    they cite a vague "legacy register import" source, and leaving them in
  //    place would make a check list that alongside the real notice.
  const seededEntityIds = (await Entity.find({ slug: { $in: [...seededSlugs] } }).select("_id").lean()).map((e) => e._id);
  const staleRecords = await Record.countDocuments({
    capturedBy: "migration:legacy-import",
    entityId: { $in: seededEntityIds },
  });

  if (staleRecords && !DRY_RUN) {
    await Record.deleteMany({ capturedBy: "migration:legacy-import", entityId: { $in: seededEntityIds } });
  }
  stats.staleRecords = staleRecords;

  // 2. Entities the importer created under a different spelling of a name this
  //    register now carries ("Quant Vest Stock Exchange (QVSE)").
  const legacyRecords = await Record.find({ capturedBy: "migration:legacy-import" }).select("entityId").lean();
  const legacyEntityIds = [...new Set(legacyRecords.map((r) => String(r.entityId)))];

  for (const id of legacyEntityIds) {
    const entity = await Entity.findById(id).lean();
    if (!entity || seededSlugs.has(entity.slug)) continue;

    // Never remove an entity that still carries a record from anyone other
    // than the importer. An earlier version of this prune deleted all seven
    // regulators because they existed only as import rows; nothing should be
    // deletable unless this register demonstrably replaces it.
    const nonLegacy = await Record.countDocuments({
      entityId: entity._id,
      capturedBy: { $ne: "migration:legacy-import" },
    });
    if (nonLegacy > 0) continue;
    // Compare with parentheticals and separators stripped, so
    // "Quant Vest Stock Exchange (QVSE)" lines up with "Quant Vest Stock Exchange".
    if (!seededNames.has(normalizeName(entity.name)) && !seededNames.has(bareName(entity.name))) continue;

    if (!DRY_RUN) {
      await Promise.all([
        Identifier.deleteMany({ entityId: entity._id }),
        Record.deleteMany({ entityId: entity._id }),
        Relation.deleteMany({ $or: [{ fromEntity: entity._id }, { toEntity: entity._id }] }),
        Entity.deleteOne({ _id: entity._id }),
      ]);
    }
    stats.pruned += 1;
  }
}

/* ------------------------------------------------------------------ *
 * Runner
 * ------------------------------------------------------------------ */

async function seed() {
  requireSecrets();
  await connectDB();

  console.log("");
  console.log(DRY_RUN ? "  🔍 DRY RUN — nothing will be written" : "  🌱 Seeding the Qwench register");
  console.log("");

  console.log("  sources...");
  const src = await seedSources();

  console.log("  SEC Ghana notice, July 2025...");
  await seedGroup(SEC_BLACKLISTED_2025, "warning", src.sec_notice_2025);

  console.log("  SEC Ghana & EOCO joint warning...");
  await seedGroup(SEC_EOCO_WARNED, "warning", src.sec_eoco_joint);

  console.log("  historical enforcement...");
  await seedGroup(HISTORICAL_SCAMS, "warning", src.sec_historical);

  console.log("  entities named by more than one regulator...");
  for (const entity of DUAL_SOURCE_CASES) {
    const doc = await seedEntity(entity);
    for (const key of entity.sourceKeys) await seedRecord(doc._id, src[key], "warning");
  }

  console.log("  impersonation cases...");
  for (const entity of IMPERSONATION_CASES) {
    const doc = await seedEntity(entity);
    await seedRecord(doc._id, src[entity.sourceKey], "warning");
  }

  console.log("  licensed market operators...");
  await seedGroup(LICENSED_ENTITIES, "licence", src.sec_register);

  console.log("  virtual asset sandbox participants...");
  await seedGroup(SANDBOX_PARTICIPANTS, "sandbox", src.sec_sandbox, {
    effectiveOn: new Date(SANDBOX_WINDOW.effectiveOn),
    endsOn: new Date(SANDBOX_WINDOW.endsOn),
  });

  console.log("  regulators and market infrastructure...");
  await seedGroup(AUTHORITIES, "registration", src.gov_bodies);

  console.log("  protected real companies (no warning records)...");
  for (const co of PROTECTED_COMPANIES) await seedEntity(co);

  console.log("  impersonation relations...");
  await seedRelations();

  console.log("  organisations...");
  await seedOrganisations();

  if (PRUNE_LEGACY) {
    console.log("  pruning superseded legacy-import rows...");
    await pruneLegacyDuplicates();
  }

  /* --- Summary --------------------------------------------------- */
  console.log("");
  console.log("  Seeded");
  console.log(`    sources        ${stats.sources}`);
  console.log(`    entities       ${stats.entities}`);
  console.log(`    identifiers    ${stats.identifiers}`);
  console.log(`    records        ${stats.records}  (active — captured by "${CAPTURED_BY}", reviewed by "${REVIEWED_BY}")`);
  console.log(`    relations      ${stats.relations}`);
  console.log(`    organisations  ${stats.organisations}`);
  if (PRUNE_LEGACY) {
    console.log(`    pruned         ${stats.pruned} superseded legacy entities`);
    console.log(`    stale records  ${stats.staleRecords || 0} import-era records removed from seeded entities`);
  }

  if (!DRY_RUN) {
    console.log("");
    console.log("  Collection totals");
    for (const [label, model] of [
      ["sources", Source],
      ["entities", Entity],
      ["identifiers", Identifier],
      ["records", Record],
      ["relations", Relation],
      ["organizations", Organization],
    ]) {
      console.log(`    ${label.padEnd(14)} ${await model.countDocuments()}`);
    }
  }

  if (stats.pendingQuotes) {
    console.log("");
    console.log(`  📝 ${stats.pendingQuotes} record(s) carry a provenance line rather than the notice's exact wording.`);
    console.log("     Transcribe the verbatim text into Record.quote when you have the notices.");
  }

  const unique = [...new Set(warnings)];
  if (unique.length) {
    console.log("");
    console.log("  ⚠️  Worth checking:");
    unique.slice(0, 10).forEach((w) => console.log(`     ${w}`));
  }

  console.log("");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error("[seed] failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
