import Investment from "../models/Investment.js";
import { blacklistedEntities, licensedEntities, sandboxEntities, slugify } from "./secData.js";

/**
 * Loads the SEC Ghana lists into MongoDB on server start.
 *
 * Idempotent: every entity is upserted by slug, so restarting the server
 * refreshes the register without duplicating anything and without touching the
 * community reports or the entries the risk engine cached itself.
 */
export async function bootstrapSecData() {
  const docs = [
    ...licensedEntities.map((e) => ({
      name: e.name,
      slug: slugify(e.name),
      aliases: dedupe([...(e.aliases || []), slugify(e.name)]),
      status: "licensed",
      source: e.source || "SEC Ghana",
      licenseType: e.licenseType || "",
      category: "investment",
      riskScore: 1,
      redFlags: [],
      dateAdded: e.dateAdded ? new Date(e.dateAdded) : new Date(),
    })),
    ...sandboxEntities.map((e) => ({
      name: e.name,
      slug: slugify(e.name),
      aliases: dedupe([...(e.aliases || []), slugify(e.name)]),
      status: "sandbox",
      source: e.source,
      licenseType: "Provisional sandbox approval",
      category: "crypto",
      riskScore: 4,
      redFlags: [],
      dateAdded: new Date(),
    })),
    ...blacklistedEntities.map((e) => ({
      name: e.name,
      slug: slugify(e.name),
      aliases: dedupe([...(e.aliases || []), slugify(e.name)]),
      status: "blacklisted",
      source: e.source || "SEC Ghana",
      licenseType: "",
      category: e.category || "other",
      riskScore: 9,
      redFlags: e.redFlags || [],
      dateAdded: e.dateAdded ? new Date(e.dateAdded) : new Date(),
    })),
  ];

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { slug: doc.slug },
      update: { $set: { ...doc, lastChecked: new Date() } },
      upsert: true,
    },
  }));

  try {
    const res = await Investment.bulkWrite(ops, { ordered: false });
    console.log(
      `[bootstrap] SEC Ghana register loaded: ${licensedEntities.length} licensed, ` +
        `${sandboxEntities.length} sandbox, ${blacklistedEntities.length} blacklisted ` +
        `(${res.upsertedCount} new, ${res.modifiedCount} updated)`
    );
  } catch (err) {
    console.error(`[bootstrap] failed to load SEC Ghana register: ${err.message}`);
  }
}

function dedupe(arr) {
  return [...new Set(arr.filter(Boolean))];
}
