import "dotenv/config";

import crypto from "node:crypto";

import bcrypt from "bcrypt";
import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import { requireSecrets } from "../config/env.js";
import { buildIdentifier, hashIdentifier, normalizeIdentifier } from "../lib/identifiers.js";
import {
  API_SCOPES,
  ApiKey,
  BrandFinding,
  BrandWatch,
  Case,
  Contribution,
  Entity,
  Identifier,
  Merchant,
  Organization,
  PublicReport,
  Record,
  Relation,
  Source,
  User,
  generateApiKey,
} from "../models/index.js";

/**
 * Creates labelled demo data for a demo database.
 *
 * Refuses to run unless ALLOW_DEMO_SEED=true. Everything is marked isDemo, every
 * name says "Demo", and no real company, bank, MoMo provider or regulator appears.
 * Payment numbers are obviously fake, so nobody real can be flagged. Running it
 * again adds no duplicates, and replaces the demo API keys with new ones.
 *
 *   ALLOW_DEMO_SEED=true node src/scripts/seed-demo.js
 */

export const DEMO_NUMBERS = {
  notice: "+233240000000",
  partner: "+233240000001",
  merchant: "+233240000002",
  advertised: "+233240000003",
};

const DEMO_ORGS = [
  { name: "Demo Bank (demo data)", type: "bank", confirmationCallLimitGhs: 500, warnsOnPartnerData: false },
  { name: "Demo MoMo Provider (demo data)", type: "momo", confirmationCallLimitGhs: 200, warnsOnPartnerData: true },
];

async function findOrCreate(Model, filter, values) {
  const existing = await Model.findOne(filter);
  if (existing) {
    if (existing.isDemo === false) throw new Error(`Refusing to touch non-demo data: ${Model.modelName} ${JSON.stringify(filter)}`);
    return existing;
  }
  return Model.create({ ...filter, ...values });
}

const demoEntity = (name, slug, kind) => findOrCreate(Entity, { slug }, { name, kind, isDemo: true, allowFuzzy: false });

async function demoIdentifier(entity, type, value, origin) {
  const built = buildIdentifier(type, value, { origin, isDemo: true, allowFuzzy: false });
  const existing = await Identifier.findOne({ entityId: entity._id, type, valueHash: built.valueHash });
  return existing || Identifier.create({ ...built, entityId: entity._id });
}

export async function seedDemo() {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("ALLOW_DEMO_SEED is not true, so no demo data was created.");
  }

  /* --- Organisations and keys -------------------------------------- */
  const orgs = [];
  for (const { name, ...rest } of DEMO_ORGS) {
    orgs.push(await findOrCreate(Organization, { name }, { ...rest, status: "demo" }));
  }

  const keys = {};
  for (const org of orgs) {
    await ApiKey.updateMany({ orgId: org._id, revokedAt: null }, { revokedAt: new Date() });
    const { rawKey, prefix, keyHash } = generateApiKey({ live: false });
    await ApiKey.create({ orgId: org._id, keyHash, prefix, scopes: API_SCOPES });
    keys[org.name] = rawKey;
  }

  // One generated password for the demo logins, shown once and replaced on each run.
  const qwenchOrg = await findOrCreate(Organization, { name: "Qwench Demo Team (demo data)" }, { type: "qwench", status: "demo" });
  const password = crypto.randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);
  const demoUsers = [
    { email: "demo-analyst@demo.qwench.test", orgId: orgs[0]._id, role: "analyst" },
    { email: "demo-admin@demo.qwench.test", orgId: orgs[0]._id, role: "org_admin" },
    { email: "demo-reviewer@demo.qwench.test", orgId: qwenchOrg._id, role: "reviewer" },
    { email: "demo-reviewer-2@demo.qwench.test", orgId: qwenchOrg._id, role: "reviewer" },
  ];
  for (const { email, orgId, role } of demoUsers) {
    const existing = await User.findOne({ email });
    if (existing) {
      existing.passwordHash = passwordHash;
      await existing.save();
    } else {
      await User.create({ email, orgId, role, passwordHash });
    }
  }
  const reviewer = await User.findOne({ email: "demo-reviewer@demo.qwench.test" });

  /* --- A notice-listed scheme -------------------------------------- */
  const source = await findOrCreate(
    Source,
    { publisher: "Qwench demo data", title: "Demo data. Not a real notice or a real publisher." },
    { type: "notice", publishedOn: new Date("2026-01-01"), isOfficial: false, isDemo: true }
  );
  const noticeScheme = await demoEntity("Demo Notice Scheme", "demo-notice-scheme", "platform");
  await demoIdentifier(noticeScheme, "name", "Demo Notice Scheme", "notice");
  await demoIdentifier(noticeScheme, "domain", "demo-notice-scheme.test", "notice");
  await demoIdentifier(noticeScheme, "momo_number", DEMO_NUMBERS.notice, "notice");
  await findOrCreate(
    Record,
    { entityId: noticeScheme._id, sourceId: source._id, type: "warning" },
    {
      jurisdiction: "GH",
      quote: "Demo data. This is not a statement by any regulator.",
      effectiveOn: new Date("2026-01-01"),
      status: "active",
      capturedBy: "demo-capturer",
      reviewedBy: "demo-reviewer",
      isDemo: true,
    }
  );

  /* --- A partner-reported number: hash only ------------------------ */
  const partnerScheme = await demoEntity("Demo Partner Scheme", "demo-partner-scheme", "platform");
  await demoIdentifier(partnerScheme, "momo_number", DEMO_NUMBERS.partner, "partner");
  const partnerHash = hashIdentifier("momo_number", normalizeIdentifier("momo_number", DEMO_NUMBERS.partner));
  for (const org of orgs) {
    await findOrCreate(
      Contribution,
      { orgId: org._id, schemeName: "Demo Partner Scheme" },
      { identifiers: [{ type: "momo_number", valueHash: partnerHash }], terms: "Demo data: 5% a day", region: "Demo region", lossBand: "Demo data", reviewStatus: "reviewed", isDemo: true }
    );
  }

  /* --- A registered merchant --------------------------------------- */
  const merchantEntity = await demoEntity("Demo Merchant Ltd", "demo-merchant-ltd", "merchant");
  const till = await demoIdentifier(merchantEntity, "momo_number", DEMO_NUMBERS.merchant, "merchant");
  const merchant = await findOrCreate(
    Merchant,
    { entityId: merchantEntity._id },
    { legalName: "Demo Merchant Ltd", verificationMethod: "merchant_account", documentRefs: ["Demo data"], officialIdentifiers: [till._id], status: "verified", verifiedBy: reviewer._id, isDemo: true }
  );

  /* --- A case ------------------------------------------------------ */
  const demoCase = await findOrCreate(
    Case,
    { caseNumber: "QW-DEMO-0001" },
    {
      type: "impersonation",
      trigger: "number_advertised_under_registered_business",
      identifiers: [{ type: "momo_number", valueHash: hashIdentifier("momo_number", normalizeIdentifier("momo_number", DEMO_NUMBERS.advertised)) }],
      status: "open",
      outcome: "Demo data",
      isDemo: true,
    }
  );

  /* --- A brand watch and finding ----------------------------------- */
  const watch = await BrandWatch.findOne({ orgId: orgs[0]._id, brandName: "Demo Merchant Ltd" })
    || (await BrandWatch.create({
      orgId: orgs[0]._id,
      brandName: "Demo Merchant Ltd",
      officialDomains: ["demo-merchant.test"],
      officialNumbers: [hashIdentifier("momo_number", normalizeIdentifier("momo_number", DEMO_NUMBERS.merchant))],
      keywords: ["demo merchant"],
    }));
  const finding = await findOrCreate(
    BrandFinding,
    { watchId: watch._id, url: "https://demo-merchant-lookalike.test" },
    { platform: "Demo data", claimedName: "Demo Merchant Ltd", identifiersFound: [{ type: "domain", value: "demo-merchant-lookalike.test" }], evidenceRefs: ["Demo data"], isDemo: true }
  );

  /* --- Things for a reviewer to review ------------------------------ */
  const pendingScheme = await demoEntity("Demo Pending Scheme", "demo-pending-scheme", "platform");
  await demoIdentifier(pendingScheme, "name", "Demo Pending Scheme", "notice");
  await findOrCreate(
    Record,
    { entityId: pendingScheme._id, sourceId: source._id, type: "warning" },
    { jurisdiction: "GH", quote: "Demo data. This is not a statement by any regulator.", effectiveOn: new Date("2026-01-01"), status: "pending", capturedBy: "demo-analyst@demo.qwench.test", isDemo: true }
  );

  const lookalike = await demoEntity("Demo Merchant Lookalike", "demo-merchant-lookalike", "platform");
  await demoIdentifier(lookalike, "domain", "demo-merchant-lookalike.test", "review");
  await findOrCreate(
    Relation,
    { fromEntity: lookalike._id, toEntity: merchantEntity._id, type: "impersonates" },
    { status: "pending", capturedBy: "demo-analyst@demo.qwench.test", isDemo: true }
  );

  await findOrCreate(
    PublicReport,
    { schemeName: "Demo Reported Scheme", isDemo: true },
    { source: "web", evidenceRefs: ["https://demo-merchant-lookalike.test/offer"], reviewStatus: "pending", expiresAt: null }
  );

  return { keys, password, users: demoUsers.map((u) => `${u.email} (${u.role})`), ids: { merchant: merchant._id, case: demoCase._id, finding: finding._id } };
}

if (process.argv[1]?.endsWith("seed-demo.js")) {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    console.error("ALLOW_DEMO_SEED is not true, so no demo data was created.");
    process.exit(1);
  }
  requireSecrets();
  await connectDB();
  const { keys, password, users } = await seedDemo();
  console.log("");
  console.log("  Demo data is ready. Everything is labelled as demo data.");
  console.log("  Demo API keys, shown once:");
  for (const [org, key] of Object.entries(keys)) console.log(`    ${org}: ${key}`);
  console.log("  Demo console logins, with one password, shown once:");
  users.forEach((u) => console.log(`    ${u}`));
  console.log(`    Password: ${password}`);
  console.log("");
  await mongoose.disconnect();
  process.exit(0);
}
