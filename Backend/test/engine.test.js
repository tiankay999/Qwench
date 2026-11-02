import assert from "node:assert/strict";
import fs from "node:fs";
import { after, before, beforeEach, test } from "node:test";

import { makeApiKey, post, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";
import { buildIdentifier, hashIdentifier } from "../src/lib/identifiers.js";
import {
  Case,
  Check,
  Contribution,
  Entity,
  Identifier,
  Merchant,
  Organization,
  PublicReport,
  Record,
  Relation,
  Signal,
  Source,
  User,
} from "../src/models/index.js";
import { evaluate } from "../src/services/evidenceEngine.js";

// All FIXTURE data. These prove the engine's rules, not any real record.
let api;
let key;
let source;
let counter = 0;

before(async () => {
  await startDb();
  api = await serve(createApp());
  key = await makeApiKey(["check"]);
});

after(async () => {
  await api.close();
  await stopDb();
});

beforeEach(async () => {
  await Promise.all(
    [Entity, Identifier, Record, Source, Relation, Merchant, Contribution, PublicReport, Signal, Case, Check].map((m) => m.deleteMany({}))
  );
  source = await Source.create({ publisher: "Fixture Regulator", type: "notice", title: "Fixture notice", url: "https://example.test/n", publishedOn: new Date("2026-07-01") });
});

async function makeEntity(name = `Fixture ${++counter}`, { kind = "platform", allowFuzzy = false, isDemo = false, domain } = {}) {
  const entity = await Entity.create({ name, slug: name.toLowerCase().replace(/\W+/g, "-"), kind, allowFuzzy, isDemo });
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("name", name), origin: "notice", allowFuzzy, isDemo });
  if (domain) await Identifier.create({ entityId: entity._id, ...buildIdentifier("domain", domain), origin: "notice", isDemo });
  return entity;
}

const addRecord = (entity, type, extra = {}) =>
  Record.create({ entityId: entity._id, sourceId: source._id, type, quote: "Fixture quote", capturedBy: "a", reviewedBy: "b", status: "active", jurisdiction: "GH", ...extra });

const org = (extra = {}) => Organization.create({ name: `Fixture Org ${++counter}`, type: "bank", status: "demo", ...extra });

const byName = (name, extra = {}) => evaluate({ recipient: name, type: "name", audience: "institution", ...extra });

const publicCheck = (body) => post(`${api.url}/v1/public/check`, body).then((r) => r.json());

/* --- Legal state -------------------------------------------------- */

test("a Ghana notice is named_in_notice, tier 1, a customer warning", async () => {
  const e = await makeEntity();
  await addRecord(e, "warning");
  const r = await byName(e.name);
  assert.equal(r.state, "named_in_notice");
  assert.equal(r.tier, 1);
  assert.deepEqual(r.reason_codes, ["REGULATOR_NOTICE"]);
  assert.equal(r.allowed_use, "customer_warning");
  assert.equal(r.suggested_action, "warn");
});

test("a sanctions listing is tier 1", async () => {
  const e = await makeEntity();
  await addRecord(e, "sanction");
  const r = await byName(e.name);
  assert.equal(r.state, "named_in_notice");
  assert.deepEqual(r.reason_codes, ["SANCTIONS_LIST"]);
});

for (const [label, type, jurisdiction] of [
  ["a foreign alert", "foreign_alert", "GB"],
  ["a warning from another country", "warning", "NG"],
]) {
  test(`${label} is context only: no tier, no warning`, async () => {
    const e = await makeEntity();
    await addRecord(e, type, { jurisdiction });
    const r = await byName(e.name);
    assert.equal(r.state, "no_record");
    assert.equal(r.tier, null);
    assert.deepEqual(r.reason_codes, []);
    assert.equal(r.allowed_use, null);
    assert.equal(r.suggested_action, "none");
    assert.equal(r.foreign_context.length, 1);
    assert.equal(r.foreign_context[0].jurisdiction, jurisdiction);
    assert.match(r.report.foreign_context[0], /context/i);
  });
}

for (const [type, state] of [["licence", "licensed"], ["sandbox", "sandbox"], ["registration", "registered"]]) {
  test(`${state} is a legal state, never a warning`, async () => {
    const e = await makeEntity();
    await addRecord(e, type, { licenseType: "Fund Manager" });
    const r = await byName(e.name);
    assert.equal(r.state, state);
    assert.equal(r.tier, null);
    assert.deepEqual(r.reason_codes, []);
    assert.deepEqual(r.warning_signs, []);
    assert.equal(r.suggested_action, "none");
  });
}

test("a notice outranks a licence", async () => {
  const e = await makeEntity();
  await addRecord(e, "licence", { licenseType: "Fund Manager" });
  await addRecord(e, "warning");
  assert.equal((await byName(e.name)).state, "named_in_notice");
});

test("a record past its end date doesn't count", async () => {
  const e = await makeEntity();
  await addRecord(e, "sandbox", { endsOn: new Date("2020-01-01") });
  const r = await byName(e.name);
  assert.equal(r.state, "no_record");
  assert.deepEqual(r.sources, []);
});

test("a record with a future end date counts", async () => {
  const e = await makeEntity();
  await addRecord(e, "sandbox", { endsOn: new Date(Date.now() + 86400000) });
  assert.equal((await byName(e.name)).state, "sandbox");
});

test("a regulator answers as an authority, even before its record is reviewed", async () => {
  const e = await makeEntity("Fixture Regulator Body", { kind: "authority" });
  await Record.create({ entityId: e._id, sourceId: source._id, type: "registration", capturedBy: "a" });
  const r = await byName(e.name);
  assert.equal(r.state, "authority");
  assert.equal(r.tier, null);
  assert.deepEqual(r.sources, []);
  assert.match(r.report.state_sentence, /regulator|public body/i);
});

/* --- Suggested action --------------------------------------------- */

test("tier 1, new payee, at the limit: confirmation call", async () => {
  const e = await makeEntity();
  await addRecord(e, "warning");
  const o = await org({ confirmationCallLimitGhs: 500 });
  const r = await byName(e.name, { org: o, new_payee: true, amount_ghs: 500 });
  assert.equal(r.suggested_action, "warn_or_confirmation_call");
});

for (const [label, extra, limit] of [
  ["below the limit", { new_payee: true, amount_ghs: 499 }, 500],
  ["not a new payee", { new_payee: false, amount_ghs: 800 }, 500],
  ["no amount given", { new_payee: true }, 500],
  ["no limit set", { new_payee: true, amount_ghs: 800 }, null],
]) {
  test(`tier 1, ${label}: warn`, async () => {
    const e = await makeEntity();
    await addRecord(e, "warning");
    const o = await org({ confirmationCallLimitGhs: limit });
    assert.equal((await byName(e.name, { org: o, ...extra })).suggested_action, "warn");
  });
}

/* --- Partner data ------------------------------------------------- */

const NUMBER = "+233240000000";
const numberHash = () => hashIdentifier("momo_number", NUMBER);

async function partnerReport(o, reviewStatus = "reviewed") {
  return Contribution.create({ orgId: o._id, schemeName: "Fixture Partner Scheme", identifiers: [{ type: "momo_number", valueHash: numberHash() }], reviewStatus, isDemo: true });
}

test("a reviewed partner number is found, as tier 2 for internal review", async () => {
  const o = await org();
  await partnerReport(o);
  const r = await evaluate({ recipient: "0240000000", type: "momo_number", audience: "institution", org: o });
  assert.equal(r.match, true);
  assert.equal(r.entity, "Fixture Partner Scheme");
  assert.equal(r.tier, 2);
  assert.deepEqual(r.reason_codes, ["PARTNER_CONFIRMED"]);
  assert.equal(r.allowed_use, "internal_review");
  assert.equal(r.suggested_action, "internal_review");
  assert.ok(!JSON.stringify(r).includes(o.name));
  assert.ok(!JSON.stringify(r).includes(String(o._id)));
});

test("an organisation that warns on partner data gets a customer warning", async () => {
  const o = await org({ warnsOnPartnerData: true });
  await partnerReport(o);
  const r = await evaluate({ recipient: NUMBER, type: "momo_number", audience: "institution", org: o });
  assert.equal(r.allowed_use, "customer_warning");
  assert.equal(r.suggested_action, "warn");
});

test("an unreviewed partner number is not found", async () => {
  await partnerReport(await org(), "pending");
  const r = await evaluate({ recipient: NUMBER, type: "momo_number", audience: "institution" });
  assert.equal(r.match, false);
  assert.equal(r.tier, null);
});

test("a partner number never reaches a public result", async () => {
  await partnerReport(await org());
  const r = await publicCheck({ recipient: NUMBER, type: "momo_number" });
  assert.equal(r.match, false);
  assert.equal(r.state, "no_record");
  assert.equal(r.tier, null);
  assert.ok(!JSON.stringify(r).includes("Fixture Partner Scheme"));
  // The demo label must not hint that a hidden record exists.
  assert.equal(r.is_demo, false);
  assert.doesNotMatch(r.report.state_sentence, /demo/i);
});

/* --- Reports and signals ------------------------------------------ */

const report = (e, source, extra = {}) =>
  PublicReport.create({ schemeName: e.name, identifiers: [{ type: "name", valueHash: hashIdentifier("name", e.name.toLowerCase()) }], source, reviewStatus: "confirmed", evidenceRefs: ["fixture"], ...extra });

test("reports from three independent sources, with evidence and reviewed: tier 3", async () => {
  const e = await makeEntity();
  for (const s of ["whatsapp", "telegram", "web"]) await report(e, s);
  const r = await byName(e.name);
  assert.equal(r.tier, 3);
  assert.deepEqual(r.reason_codes, ["CORROBORATED_REPORTS"]);
  assert.equal(r.allowed_use, "internal_review");
  assert.equal(r.suggested_action, "internal_review");
});

test("twenty confirmed reports from one source stay below tier 3", async () => {
  const e = await makeEntity();
  for (let i = 0; i < 20; i += 1) await report(e, "whatsapp");
  assert.equal((await byName(e.name)).tier, null);
});

test("unreviewed reports, or reports with no evidence, don't count", async () => {
  const e = await makeEntity();
  for (const s of ["whatsapp", "telegram", "web"]) await report(e, s, { reviewStatus: "pending" });
  assert.equal((await byName(e.name)).tier, null);
  for (const s of ["whatsapp", "telegram", "web"]) await report(e, s, { evidenceRefs: [] });
  assert.equal((await byName(e.name)).tier, null);
});

test("reports can never change a public result", async () => {
  const e = await makeEntity("Fixture Reported", { domain: "fixture-reported.test" });
  const first = await publicCheck({ recipient: e.name, type: "name" });
  for (const s of ["whatsapp", "telegram", "web"]) await report(e, s);
  for (let i = 0; i < 20; i += 1) await report(e, "web", { reviewStatus: "pending" });
  const second = await publicCheck({ recipient: e.name, type: "name" });
  delete first.checked_at;
  delete second.checked_at;
  assert.deepEqual(second, first);
  assert.equal(second.tier, null);
});

test("a reviewed rise in checks is tier 4, watch", async () => {
  const e = await makeEntity();
  await Signal.create({ key: e.slug, weekStart: new Date("2026-10-26"), anomalyFlag: true, reviewStatus: "reviewed" });
  const r = await byName(e.name);
  assert.equal(r.tier, 4);
  assert.deepEqual(r.reason_codes, ["CHECK_SPIKE"]);
  assert.equal(r.allowed_use, "watch");
  assert.equal(r.suggested_action, "watch");
});

test("an unreviewed rise in checks counts for nothing", async () => {
  const e = await makeEntity();
  await Signal.create({ key: e.slug, weekStart: new Date("2026-10-26"), anomalyFlag: true, reviewStatus: "pending" });
  assert.equal((await byName(e.name)).tier, null);
  await Signal.create({ key: hashIdentifier("name", "unknown fixture"), weekStart: new Date("2026-10-26"), anomalyFlag: true, reviewStatus: "pending" });
  assert.equal((await byName("Unknown Fixture")).tier, null);
});

/* --- Names -------------------------------------------------------- */

test("a close name is offered as did_you_mean, and is never a match", async () => {
  const e = await makeEntity("Vaulta Fixture", { allowFuzzy: true });
  await addRecord(e, "sandbox");
  const r = await byName("Vaultaa Fixture");
  assert.equal(r.match, false);
  assert.equal(r.entity, null);
  assert.equal(r.state, "no_record");
  assert.equal(r.tier, null);
  assert.equal(r.did_you_mean.suggested_entity, "Vaulta Fixture");
});

test("did_you_mean carries no score or status", async () => {
  const e = await makeEntity("Vaulta Fixture", { allowFuzzy: true });
  await addRecord(e, "warning");
  const r = await byName("Vaultaa Fixture");
  assert.deepEqual(Object.keys(r.did_you_mean), ["suggested_entity"]);
});

test("a dressed-up version of a notice name is did_you_mean, not a warning", async () => {
  const e = await makeEntity("Menzfix Gold", { allowFuzzy: true });
  await addRecord(e, "warning");
  for (const query of ["Menzfix G0ld", "Menzfix Gold Premium"]) {
    const r = await byName(query);
    assert.equal(r.match, false, query);
    assert.equal(r.tier, null, query);
    assert.equal(r.did_you_mean?.suggested_entity, "Menzfix Gold", query);
  }
});

test("an entity without allowFuzzy only matches exactly", async () => {
  const e = await makeEntity("Vaulta Exact", { allowFuzzy: false });
  await addRecord(e, "sandbox");
  const r = await byName("Vaultaa Exact");
  assert.equal(r.match, false);
  assert.equal(r.did_you_mean, undefined);
});

test("a name with only pending records is never suggested", async () => {
  const e = await makeEntity("Vaulta Pending", { allowFuzzy: true });
  await Record.create({ entityId: e._id, sourceId: source._id, type: "sandbox", capturedBy: "a" });
  const r = await byName("Vaultaa Pending");
  assert.equal(r.match, false);
  assert.equal(r.did_you_mean, undefined);
});

test("nothing is suggested from the old unreviewed list", async () => {
  const { default: Investment } = await import("../src/models/Investment.js");
  await Investment.create({ name: "VAULTA", slug: "vaulta", status: "sandbox", aliases: [] });
  const r = await byName("Vaultaa");
  assert.equal(r.did_you_mean, undefined);
  await Investment.deleteMany({});
});

for (const allowFuzzy of [false, true]) {
  test(`Daraz doesn't match or suggest Darazz (allowFuzzy ${allowFuzzy})`, async () => {
    const e = await makeEntity("Darazz", { allowFuzzy });
    await addRecord(e, "warning");
    const r = await byName("Daraz");
    assert.equal(r.match, false);
    assert.equal(r.did_you_mean, undefined);
  });
}

test("an unrelated name gets no suggestion", async () => {
  const e = await makeEntity("Gold Coast Fund Management", { allowFuzzy: true });
  await addRecord(e, "licence", { licenseType: "Fund Manager" });
  assert.equal((await byName("Gold Trust")).did_you_mean, undefined);
});

/* --- Merchant registry -------------------------------------------- */

async function registeredMerchant(name = "Fixture Shop Ltd") {
  const e = await Entity.create({ name, slug: name.toLowerCase().replace(/\W+/g, "-"), kind: "merchant" });
  const till = await Identifier.create({ entityId: e._id, ...buildIdentifier("momo_number", "+233240000005"), origin: "merchant" });
  const orgDoc = await org();
  const user = await User.create({ orgId: orgDoc._id, email: `fixture${++counter}@example.test`, role: "reviewer", passwordHash: "$2b$04$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu" });
  await Merchant.create({ entityId: e._id, legalName: name, officialIdentifiers: [till._id], status: "verified", verifiedBy: user._id });
  return e;
}

test("a registered merchant's number says who registered it", async () => {
  await registeredMerchant();
  const r = await evaluate({ recipient: "0240000005", type: "momo_number", audience: "institution" });
  assert.equal(r.state, "registered");
  assert.equal(r.tier, null);
  assert.equal(r.merchant_claim.business, "Fixture Shop Ltd");
  assert.match(r.report.state_sentence, /Registered by Fixture Shop Ltd/);
});

test("a number advertised under a registered business opens a review, with no public claim", async () => {
  await registeredMerchant();
  const r = await evaluate({ recipient: "0240000006", type: "momo_number", advertised_as: "Fixture Shop Ltd", audience: "public" });
  assert.equal(r.match, false);
  assert.equal(r.tier, null);
  assert.deepEqual(r.reason_codes, []);

  const cases = await Case.find({}).lean();
  assert.equal(cases.length, 1);
  assert.equal(cases[0].type, "impersonation");
  assert.equal(cases[0].status, "open");
  assert.equal(cases[0].identifiers[0].valueHash, hashIdentifier("momo_number", "+233240000006"));
  assert.ok(!JSON.stringify(cases).includes("233240000006"));
});

test("asking again doesn't open a second review", async () => {
  await registeredMerchant();
  for (let i = 0; i < 3; i += 1) {
    await evaluate({ recipient: "0240000006", type: "momo_number", advertised_as: "Fixture Shop Ltd" });
  }
  assert.equal(await Case.countDocuments(), 1);
});

test("a merchant's own number, advertised under its name, opens nothing", async () => {
  await registeredMerchant();
  await evaluate({ recipient: "0240000005", type: "momo_number", advertised_as: "Fixture Shop Ltd" });
  assert.equal(await Case.countDocuments(), 0);
});

test("an unregistered business gets no claim and no review", async () => {
  const r = await evaluate({ recipient: "0240000006", type: "momo_number", advertised_as: "Some Other Shop" });
  assert.equal(r.merchant_claim, undefined);
  assert.equal(await Case.countDocuments(), 0);
});

const reviewedBy = { capturedBy: "capturer", reviewedBy: "reviewer", status: "active" };

test("a reviewed impersonation is tier 2, and institutions may warn customers", async () => {
  const real = await registeredMerchant();
  const fake = await makeEntity("Fixture Fake Shop", { domain: "fake-shop.test" });
  await Relation.create({ fromEntity: fake._id, toEntity: real._id, type: "impersonates", ...reviewedBy });
  const r = await byName(fake.name);
  assert.equal(r.tier, 2);
  assert.deepEqual(r.reason_codes, ["ADVERTISED_AS_BUSINESS_NOT_REGISTERED"]);
  assert.equal(r.allowed_use, "customer_warning");
  assert.equal(r.suggested_action, "warn");
});

test("a reviewed impersonation is shown publicly, naming the business", async () => {
  const real = await registeredMerchant();
  const fake = await makeEntity("Fixture Fake Shop", { domain: "fake-shop.test" });
  const relationSource = await Source.create({ publisher: "Fixture Shop Ltd", type: "press_release", title: "Fixture confirmation", url: "https://example.test/c", publishedOn: new Date("2026-08-01") });
  await Relation.create({ fromEntity: fake._id, toEntity: real._id, type: "impersonates", sourceId: relationSource._id, ...reviewedBy });

  const body = await publicCheck({ recipient: "fake-shop.test", type: "domain" });
  assert.equal(body.match, true);
  assert.equal(body.entity, "Fixture Fake Shop");
  assert.equal(body.state, "no_record");
  assert.equal(body.tier, 2);
  assert.deepEqual(body.reason_codes, ["ADVERTISED_AS_BUSINESS_NOT_REGISTERED"]);
  assert.match(body.report.state_sentence, /Fixture Shop Ltd/);
  assert.doesNotMatch(body.report.state_sentence, /No record found/);
  assert.equal(body.report.sources[0].url, "https://example.test/c");
});

test("the same public check doesn't reveal partner data alongside it", async () => {
  const real = await registeredMerchant();
  const fake = await makeEntity("Fixture Fake Shop", { domain: "fake-shop.test" });
  await Relation.create({ fromEntity: fake._id, toEntity: real._id, type: "impersonates", ...reviewedBy });
  await Contribution.create({ orgId: (await org())._id, schemeName: fake.name, identifiers: [{ type: "domain", valueHash: hashIdentifier("domain", "fake-shop.test") }], reviewStatus: "reviewed" });
  const body = await publicCheck({ recipient: "fake-shop.test", type: "domain" });
  assert.deepEqual(body.reason_codes, ["ADVERTISED_AS_BUSINESS_NOT_REGISTERED"]);
});

test("an impersonation nobody has reviewed changes nothing, anywhere", async () => {
  const real = await registeredMerchant();
  const fake = await makeEntity("Fixture Fake Shop", { domain: "fake-shop.test" });
  await Relation.create({ fromEntity: fake._id, toEntity: real._id, type: "impersonates", capturedBy: "capturer" });
  assert.equal((await byName(fake.name)).tier, null);
  const body = await publicCheck({ recipient: "fake-shop.test", type: "domain" });
  assert.equal(body.match, false);
  assert.equal(body.tier, null);
  assert.ok(!JSON.stringify(body).includes("Fixture Shop Ltd"));
});

test("an impersonation can't go live without a second person", async () => {
  const real = await registeredMerchant();
  const fake = await makeEntity("Fixture Fake Shop");
  const base = { fromEntity: fake._id, toEntity: real._id, type: "impersonates" };
  assert.equal((await Relation.create({ ...base, capturedBy: "capturer" })).status, "pending");
  await Relation.deleteMany({});
  await assert.rejects(Relation.create({ ...base, status: "active" }), /review/i);
  await assert.rejects(Relation.create({ ...base, status: "active", capturedBy: "capturer" }), /review/i);
  await assert.rejects(Relation.create({ ...base, status: "active", capturedBy: "Ama", reviewedBy: " ama " }), /different person/i);
});

test("an update can't skip that review", async () => {
  const real = await registeredMerchant();
  const fake = await makeEntity("Fixture Fake Shop");
  const relation = await Relation.create({ fromEntity: fake._id, toEntity: real._id, type: "impersonates", capturedBy: "capturer" });
  await assert.rejects(Relation.updateOne({ _id: relation._id }, { status: "active" }), /save/i);
  await assert.rejects(Relation.findOneAndUpdate({ _id: relation._id }, { $set: { status: "active", reviewedBy: "capturer" } }), /save/i);
  relation.set({ status: "active", reviewedBy: "reviewer" });
  await relation.save();
  assert.ok(relation.reviewedAt);
});

test("a disputed impersonation stops showing", async () => {
  const real = await registeredMerchant();
  const fake = await makeEntity("Fixture Fake Shop", { domain: "fake-shop.test" });
  const relation = await Relation.create({ fromEntity: fake._id, toEntity: real._id, type: "impersonates", ...reviewedBy });
  relation.status = "disputed";
  await relation.save();
  assert.equal((await publicCheck({ recipient: "fake-shop.test", type: "domain" })).tier, null);
});

test("reports against a registered merchant change nothing", async () => {
  const e = await registeredMerchant();
  const hash = hashIdentifier("momo_number", "+233240000005");
  for (const s of ["whatsapp", "telegram", "web"]) {
    await PublicReport.create({ schemeName: e.name, identifiers: [{ type: "momo_number", valueHash: hash }], source: s, reviewStatus: "pending", evidenceRefs: ["fixture"] });
  }
  const r = await evaluate({ recipient: "0240000005", type: "momo_number", audience: "institution" });
  assert.equal(r.state, "registered");
  assert.equal(r.tier, null);
  assert.deepEqual(r.reason_codes, []);
});

test("a number on a company with no merchant entry isn't flagged", async () => {
  const e = await Entity.create({ name: "Fixture Company", slug: "fixture-company", kind: "company" });
  await Identifier.create({ entityId: e._id, ...buildIdentifier("momo_number", "+233240000007"), origin: "review" });
  const r = await evaluate({ recipient: "0240000007", type: "momo_number", audience: "institution" });
  assert.deepEqual(r.reason_codes, []);
  assert.equal(r.tier, null);
  assert.equal(await Case.countDocuments(), 0);
});

/* --- Demo data ---------------------------------------------------- */

test("a result from demo data says so", async () => {
  const demoSource = await Source.create({ publisher: "Qwench demo data", type: "notice", title: "Demo", publishedOn: new Date("2026-01-01"), isDemo: true });
  const e = await makeEntity("Demo Fixture", { isDemo: true });
  await addRecord(e, "warning", { sourceId: demoSource._id, isDemo: true });
  const r = await byName(e.name);
  assert.equal(r.is_demo, true);
  assert.match(r.report.state_sentence, /^Demo data/);
});

test("a real result is not marked as demo", async () => {
  const e = await makeEntity();
  await addRecord(e, "warning");
  assert.equal((await byName(e.name)).is_demo, false);
  assert.equal((await byName("Nothing Here")).is_demo, false);
});

test("a partner result from demo data says so", async () => {
  await partnerReport(await org());
  assert.equal((await evaluate({ recipient: NUMBER, type: "momo_number", audience: "institution" })).is_demo, true);
});

/* --- Routes ------------------------------------------------------- */

for (const [label, send] of [
  ["/v1/public/check", (body) => publicCheck(body)],
  ["/v1/check", (body) => post(`${api.url}/v1/check`, body, { "x-api-key": key }).then((r) => r.json())],
]) {
  test(`${label}: an unknown number gets the full no-record shape`, async () => {
    const body = await send({ recipient: "0240000009", type: "momo_number" });
    assert.equal(body.match, false);
    assert.equal(body.state, "no_record");
    assert.equal(body.is_demo, false);
    assert.ok(body.checked_at);
    assert.ok(!JSON.stringify(body).includes("233240000009"));
    assert.equal(body.value_hash, undefined);
    assert.equal(body.normalized, undefined);
  });
}

test("/v1/check: an unknown recipient suggests no action", async () => {
  const res = await post(`${api.url}/v1/check`, { recipient: "0240000009", type: "momo_number" }, { "x-api-key": key });
  const body = await res.json();
  assert.equal(body.suggested_action, "none");
});

test("/v1/check uses the calling organisation's limit", async () => {
  const { ApiKey, generateApiKey } = await import("../src/models/index.js");
  const o = await org({ confirmationCallLimitGhs: 100 });
  const k = generateApiKey({ live: false });
  await ApiKey.create({ orgId: o._id, keyHash: k.keyHash, prefix: k.prefix, scopes: ["check"] });
  const e = await makeEntity("Fixture Limit", { domain: "fixture-limit.test" });
  await addRecord(e, "warning");
  const res = await post(`${api.url}/v1/check`, { recipient: "fixture-limit.test", type: "domain", new_payee: true, amount_ghs: 100 }, { "x-api-key": k.rawKey });
  assert.equal((await res.json()).suggested_action, "warn_or_confirmation_call");
});

test("/v1/public/check returns a report and no institution-only fields", async () => {
  const e = await makeEntity("Fixture Public", { domain: "fixture-public.test" });
  await addRecord(e, "warning");
  const body = await publicCheck({ recipient: "fixture-public.test", type: "domain" });
  assert.equal(body.state, "named_in_notice");
  assert.equal(body.tier, 1);
  assert.ok(body.report.state_sentence);
  assert.equal(body.report.sources[0].url, "https://example.test/n");
  assert.equal(body.is_demo, false);
  for (const field of ["suggested_action", "allowed_use", "entity_id", "value_hash", "normalized"]) assert.equal(body[field], undefined, field);
});

test("/api/check doesn't send identifiers back", async () => {
  const res = await post(`${api.url}/api/check`, { query: "0240000009" });
  const { data } = await res.json();
  assert.equal(data.state, "no_record");
  assert.equal(data.value_hash, undefined);
  assert.equal(data.normalized, undefined);
  assert.equal(data.pending_reports, undefined);
});

test("a check is logged with hashes only, without holding up the reply", async () => {
  await publicCheck({ recipient: "0240000008", type: "momo_number" });
  let rows = [];
  for (let i = 0; i < 50 && !rows.length; i += 1) {
    rows = await Check.collection.find({}).toArray();
    if (!rows.length) await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(rows.length, 1);
  assert.ok(!JSON.stringify(rows).includes("233240000008"));
  assert.equal(rows[0].identifierHashes[0], hashIdentifier("momo_number", "+233240000008"));
});

test("name checks write no raw query to the log", async () => {
  const lines = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  for (const k of Object.keys(original)) console[k] = (...args) => lines.push(args.join(" "));
  try {
    const e = await makeEntity("Vaulta Logged", { allowFuzzy: true });
    await addRecord(e, "sandbox");
    await byName("Vaultaa Logged");
    await byName("Secret Query Text");
  } finally {
    Object.assign(console, original);
  }
  assert.ok(!lines.join("\n").toLowerCase().includes("secret query text"));
  assert.ok(!lines.join("\n").toLowerCase().includes("vaultaa logged"));
});

/* --- What the engine is built from -------------------------------- */

test("the engine and /v1 routes don't use the old scoring code", () => {
  for (const file of ["src/services/evidenceEngine.js", "src/routes/public.js", "src/routes/institutional.js", "src/engine/report.js", "src/engine/extract.js"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /riskEngine|coingecko|goplus/, file);
  }
});

test("a no-record offer: the allowed sentence, a return check and warning signs", async () => {
  const r = await evaluate({ recipient: "GoldWave", type: "name", text: "GoldWave pays 5% a day, guaranteed. Refer 5 friends." });
  assert.equal(r.match, false);
  assert.equal(r.state, "no_record");
  assert.match(r.report.state_sentence, /This does not mean it is safe or unsafe\./);
  assert.equal(r.report.return_check.annual_percent, 1825);
  assert.ok(r.report.warning_signs.length >= 2);
  assert.equal(await Record.countDocuments(), 0);
});

test("AI being unavailable doesn't affect a check", async () => {
  const e = await makeEntity();
  await addRecord(e, "warning");
  assert.equal(process.env.GEMINI_API_KEY, undefined);
  const r = await byName(e.name, { text: "Earn 5% a day" });
  assert.equal(r.tier, 1);
  assert.equal(r.return_check.annual_percent, 1825);
});
