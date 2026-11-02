import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import { requireSecrets } from "../config/env.js";
import { buildIdentifier, slugifyEntity } from "../lib/identifiers.js";
import { Entity, Identifier, Record, Source } from "../models/index.js";

/**
 * Imports the unreviewed sec-ghana.json list as a starting point for the data lead.
 *
 * Every record lands as pending, with no quote and no link, because the list has
 * neither. A check never returns a pending record. Running it again adds nothing
 * and never touches a record someone has reviewed.
 *
 *   node src/scripts/migrate-legacy.js
 */

const LEGACY_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "../data/sec-ghana.json");
const CAPTURED_BY = "migration:legacy";

const GROUPS = [
  { key: "blacklisted", recordType: "warning", kind: (e) => (e.category === "crypto" ? "token" : "platform") },
  { key: "licensed", recordType: "licence", kind: () => "company" },
  { key: "sandbox", recordType: "sandbox", kind: () => "platform" },
  { key: "authorities", recordType: "registration", kind: () => "authority" },
];

async function legacySource(publisher, compiledOn) {
  const title = `Unreviewed legacy list, ${publisher} (sec-ghana.json). Not a publication.`;
  const existing = await Source.findOne({ publisher, title });
  if (existing) return existing;
  // publishedOn is the date the list was compiled, the only date it carries.
  return Source.create({ publisher, title, type: "register", publishedOn: new Date(compiledOn), isOfficial: false });
}

export async function migrateLegacy({ file = LEGACY_FILE } = {}) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const report = { entities: 0, identifiers: 0, records: 0, recordsSkipped: 0 };

  for (const { key, recordType, kind } of GROUPS) {
    for (const row of data[key] || []) {
      const slug = slugifyEntity(row.name);
      let entity = await Entity.findOne({ slug });
      if (!entity) {
        entity = await Entity.create({ name: row.name, slug, kind: kind(row), aliases: row.aliases || [] });
        report.entities += 1;
      }

      for (const label of [row.name, ...(row.aliases || [])]) {
        const built = buildIdentifier("name", label, { origin: "legacy", allowFuzzy: false });
        if (!built.valueHash) continue;
        if (await Identifier.exists({ entityId: entity._id, type: "name", valueHash: built.valueHash })) continue;
        await Identifier.create({ ...built, entityId: entity._id });
        report.identifiers += 1;
      }

      const source = await legacySource(row.source || "SEC Ghana", data._lastUpdated);
      const recordKey = { entityId: entity._id, sourceId: source._id, type: recordType };
      if (await Record.exists(recordKey)) {
        report.recordsSkipped += 1;
        continue;
      }
      await Record.create({
        ...recordKey,
        licenseType: row.licenseType || undefined,
        effectiveOn: row.dateAdded ? new Date(row.dateAdded) : undefined,
        status: "pending",
        capturedBy: CAPTURED_BY,
      });
      report.records += 1;
    }
  }

  return report;
}

if (process.argv[1]?.endsWith("migrate-legacy.js")) {
  requireSecrets();
  await connectDB();
  const report = await migrateLegacy();
  console.log("");
  console.log(`  Entities added:     ${report.entities}`);
  console.log(`  Identifiers added:  ${report.identifiers}`);
  console.log(`  Records added:      ${report.records} (all pending)`);
  console.log(`  Records left as is: ${report.recordsSkipped}`);
  console.log("");
  await mongoose.disconnect();
  process.exit(0);
}
