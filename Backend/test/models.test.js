import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, beforeEach, test } from "node:test";

import { post, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";
import { buildIdentifier, hashIdentifier } from "../src/lib/identifiers.js";
import {
  ApiKey,
  Appeal,
  BrandFinding,
  Case,
  Check,
  Entity,
  Identifier,
  Merchant,
  Organization,
  PublicReport,
  Record,
  Relation,
  SenderDay,
  Source,
} from "../src/models/index.js";
import { logCheck } from "../src/utils/logCheck.js";

// All data here is FIXTURE data. These tests prove the model rules, not any record.
let api;
let source;
let entity;

before(async () => {
  await startDb();
  api = await serve(createApp());
  source = await Source.create({ publisher: "Fixture publisher", type: "notice", title: "Fixture notice", publishedOn: new Date("2026-07-01") });
  entity = await Entity.create({ name: "Fixture Entity", slug: "fixture-entity", kind: "platform" });
});

after(async () => {
  await api.close();
  await stopDb();
});

beforeEach(async () => {
  await Promise.all([Identifier.deleteMany({}), Record.deleteMany({}), Check.deleteMany({}), PublicReport.deleteMany({}), SenderDay.deleteMany({})]);
});

const activeRecord = (extra = {}) => ({
  entityId: entity._id,
  sourceId: source._id,
  type: "warning",
  quote: "Exact regulator wording",
  capturedBy: "capturer",
  reviewedBy: "reviewer",
  status: "active",
  ...extra,
});

/* --- Record ------------------------------------------------------- */

test("record: a complete, reviewed record can go active", async () => {
  const record = await Record.create(activeRecord());
  assert.equal(record.status, "active");
});

test("record: active fails with no source", async () => {
  await assert.rejects(Record.create(activeRecord({ sourceId: undefined })));
});

test("record: active fails with no quote", async () => {
  await assert.rejects(Record.create(activeRecord({ quote: undefined })), /quote/i);
  await assert.rejects(Record.create(activeRecord({ quote: "   " })), /quote/i);
});

test("record: active fails with no reviewer", async () => {
  await assert.rejects(Record.create(activeRecord({ reviewedBy: undefined })));
});

test("record: active fails when the reviewer is the capturer, ignoring case and spaces", async () => {
  await assert.rejects(Record.create(activeRecord({ capturedBy: "Ama", reviewedBy: " ama " })), /four-eyes/i);
});

test("record: bulk insert applies the same rules", async () => {
  await assert.rejects(Record.insertMany([activeRecord({ quote: undefined })]), /quote/i);
});

test("record: an update cannot skip validation to go active", async () => {
  const pending = await Record.create({ entityId: entity._id, sourceId: source._id, type: "warning", capturedBy: "capturer" });
  await assert.rejects(Record.updateOne({ _id: pending._id }, { status: "active" }), /save/i);
  await assert.rejects(Record.updateMany({}, { $set: { status: "active" } }), /save/i);
  await assert.rejects(Record.findOneAndUpdate({ _id: pending._id }, { $set: { status: "active" } }), /save/i);
  await assert.rejects(Record.findOneAndUpdate({ _id: pending._id }, { $set: { quote: "edited", reviewedBy: "capturer" } }), /save/i);
  assert.equal((await Record.findById(pending._id)).status, "pending");
});

test("record: new records start pending, and need no quote until active", async () => {
  const record = await Record.create({ entityId: entity._id, sourceId: source._id, type: "warning", capturedBy: "capturer" });
  assert.equal(record.status, "pending");
  assert.equal(record.isDemo, false);
});

test("record: statuses are pending, active, expired and withdrawn", async () => {
  for (const status of ["expired", "withdrawn"]) {
    assert.equal((await Record.create(activeRecord({ status }))).status, status);
  }
  for (const status of ["under_review", "superseded"]) {
    await assert.rejects(Record.create(activeRecord({ status })));
  }
});

/* --- Identifier --------------------------------------------------- */

const number = (origin, value = "+233240000000") => ({ entityId: entity._id, ...buildIdentifier("momo_number", value), origin });

test("identifier: a partner number is stored as a hash only", async () => {
  await Identifier.create(number("partner"));
  const row = await Identifier.collection.findOne({ origin: "partner" });
  assert.equal(row.raw, "");
  assert.equal(row.normalized, "");
  assert.match(row.valueHash, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(row).includes("233240000000"));
});

test("identifier: every partner identifier is hash only, whatever its type", async () => {
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("domain", "fixture-partner.test"), origin: "partner" });
  const row = await Identifier.collection.findOne({ origin: "partner" });
  assert.equal(row.raw, "");
  assert.equal(row.normalized, "");
});

for (const origin of ["merchant", "review", "legacy", undefined]) {
  test(`identifier: a number with origin ${origin} is stored as a hash only`, async () => {
    await Identifier.create(number(origin));
    const row = await Identifier.collection.findOne({ type: "momo_number" });
    assert.ok(!JSON.stringify(row).includes("233240000000"));
  });
}

test("identifier: a bank account is treated the same way", async () => {
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("bank_account", "0012345678"), origin: "merchant" });
  const row = await Identifier.collection.findOne({ type: "bank_account" });
  assert.equal(row.normalized, "");
});

test("identifier: a number published in a notice stays readable, for the feed", async () => {
  await Identifier.create(number("notice"));
  const row = await Identifier.collection.findOne({ type: "momo_number" });
  assert.equal(row.normalized, "+233240000000");
});

test("identifier: an update cannot put a readable number back", async () => {
  const row = await Identifier.create(number("partner"));
  await assert.rejects(Identifier.updateOne({ _id: row._id }, { $set: { normalized: "+233240000000" } }), /save/i);
  await assert.rejects(Identifier.updateOne({ _id: row._id }, { raw: "+233240000000" }), /save/i);
});

test("identifier: an upsert cannot store a readable number", async () => {
  const built = number("partner");
  await assert.rejects(Identifier.findOneAndUpdate({ valueHash: built.valueHash }, { $set: built }, { upsert: true }), /save/i);
});

test("identifier: a public domain keeps its readable form", async () => {
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("domain", "https://www.Fixture.test/x"), origin: "merchant" });
  assert.equal((await Identifier.collection.findOne({ type: "domain" })).normalized, "fixture.test");
});

test("identifier: origin must be a known value", async () => {
  await assert.rejects(Identifier.create(number("somewhere else")));
});

test("identifier: valueHash is HMAC-SHA256 of type and value, under HMAC_SECRET_KEY", () => {
  const expected = crypto.createHmac("sha256", process.env.HMAC_SECRET_KEY).update("momo_number:+233240000000").digest("hex");
  assert.equal(hashIdentifier("momo_number", "+233240000000"), expected);
});

test("identifier: the same number in any format has the same hash", () => {
  const hashes = ["0241234567", "233241234567", "+233 24 123 4567"].map((v) => buildIdentifier("momo_number", v).valueHash);
  assert.equal(new Set(hashes).size, 1);
});

test("identifier: the same digits as a MoMo number and a bank account differ", () => {
  assert.notEqual(hashIdentifier("momo_number", "123"), hashIdentifier("bank_account", "123"));
});

/* --- Check events ------------------------------------------------- */

const event = () => ({ channel: "web", inputType: "number", identifierHashes: ["a".repeat(64)], state: "no_record" });

test("check event: every check is saved, not just the first", async () => {
  await logCheck(event());
  await logCheck(event());
  await logCheck(event());
  assert.equal(await Check.countDocuments(), 3);
});

test("check event: holds no exact time and no sender", async () => {
  await logCheck({ ...event(), sender: "+233240000000" });
  const row = await Check.collection.findOne({});
  assert.equal(row.createdAt, undefined);
  assert.equal(row.updatedAt, undefined);
  assert.equal(row.senderHash, undefined);
  assert.equal(row.senderHashExpiresAt, undefined);
  assert.match(row.hourBucket, /^\d{4}-\d{2}-\d{2}T\d{2}$/);
  assert.equal(row.isDemo, false);
});

test("check event: the authority state is accepted", async () => {
  await logCheck({ ...event(), state: "authority" });
  assert.equal((await Check.collection.findOne({})).state, "authority");
});

test("check event: a failed write logs no raw detail", async () => {
  const original = console.error;
  const lines = [];
  console.error = (...args) => lines.push(args.join(" "));
  try {
    await logCheck({ ...event(), channel: "+233240000000" });
  } finally {
    console.error = original;
  }
  assert.ok(lines.length > 0);
  assert.ok(!lines.join("\n").includes("233240000000"));
});

test("public check: nothing about the sender or number reaches the database", async () => {
  const res = await post(
    `${api.url}/v1/public/check`,
    { recipient: "+233240000000", type: "momo_number" },
    { "x-sender": "+233249999999", "x-channel": "whatsapp" }
  );
  assert.equal(res.status, 200);
  const rows = await Check.collection.find({}).toArray();
  assert.equal(rows.length, 1);
  const stored = JSON.stringify(rows);
  assert.ok(!stored.includes("233240000000"));
  assert.ok(!stored.includes("233249999999"));
  assert.equal(rows[0].senderHash, undefined);
});

/* --- Sender day --------------------------------------------------- */

test("sender day: unique per sender and day, and deleted by a TTL index", async () => {
  const row = { senderHash: "a".repeat(64), day: "2026-11-01", expiresAt: new Date(Date.now() + 86400000) };
  assert.equal((await SenderDay.create(row)).count, 0);
  await assert.rejects(SenderDay.create(row));
  const indexes = await SenderDay.collection.indexes();
  assert.equal(indexes.find((i) => i.key.expiresAt)?.expireAfterSeconds, 0);
});

/* --- Public reports ----------------------------------------------- */

test("public report: every report is saved, not just the first", async () => {
  await PublicReport.create({ schemeName: "Fixture A" });
  await PublicReport.create({ schemeName: "Fixture B" });
  assert.equal(await PublicReport.countDocuments(), 2);
});

test("public report: unconfirmed reports expire after 90 days, through a TTL index", async () => {
  const report = await PublicReport.create({ schemeName: "Fixture" });
  const days = (report.expiresAt - Date.now()) / 86400000;
  assert.ok(days > 89.9 && days <= 90);
  const indexes = await PublicReport.collection.indexes();
  assert.equal(indexes.find((i) => i.key.expiresAt)?.expireAfterSeconds, 0);
});

test("public report: a confirmed report does not expire", async () => {
  const report = await PublicReport.create({ schemeName: "Fixture" });
  report.reviewStatus = "confirmed";
  await report.save();
  assert.equal((await PublicReport.collection.findOne({ _id: report._id })).expiresAt, null);
});

/* --- New fields --------------------------------------------------- */

test("organization: has a confirmation call limit and partner-warning setting", async () => {
  const org = await Organization.create({ name: "Fixture Bank", type: "bank", status: "demo", confirmationCallLimitGhs: 500 });
  assert.equal(org.confirmationCallLimitGhs, 500);
  assert.equal(org.warnsOnPartnerData, false);
});

test("entity: names match exactly unless fuzzy matching is switched on", async () => {
  const row = await Entity.create({ name: "Fixture Exact", slug: "fixture-exact", kind: "platform" });
  assert.equal(row.allowFuzzy, false);
});

test("api key: records when it was last used", () => {
  assert.ok(ApiKey.schema.path("lastUsedAt"));
});

for (const [name, model] of Object.entries({ Source, Entity, Identifier, Record, Check, Case, Merchant, BrandFinding })) {
  test(`${name}: can be labelled as demo data, and is not by default`, () => {
    assert.equal(model.schema.path("isDemo")?.defaultValue, false);
  });
}

/* --- Rules already in place --------------------------------------- */

test("relation: a licensed company cannot be recorded as the impersonator", async () => {
  const licensed = await Entity.create({ name: "Fixture Licensed", slug: "fixture-licensed", kind: "company" });
  await Record.create(activeRecord({ entityId: licensed._id, type: "licence" }));
  await assert.rejects(Relation.create({ fromEntity: licensed._id, toEntity: entity._id, type: "impersonates" }), /impersonator/);
  await Relation.create({ fromEntity: entity._id, toEntity: licensed._id, type: "impersonates" });
});

test("appeal: the contact is encrypted, then cleared on closure", async () => {
  const appeal = await Appeal.create({ identifierHash: "a".repeat(64), contact: "fixture@example.test", reason: "Fixture" });
  assert.ok(!appeal.contact.includes("fixture@example.test"));
  appeal.status = "upheld";
  await appeal.save();
  assert.equal(appeal.contact, "");
});
