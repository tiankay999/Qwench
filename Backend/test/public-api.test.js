import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

import { post, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";
import { buildIdentifier, hashIdentifier } from "../src/lib/identifiers.js";
import {
  Appeal,
  Case,
  Check,
  Contribution,
  Entity,
  Identifier,
  Merchant,
  Organization,
  PublicReport,
  Record,
  SenderDay,
  Source,
  User,
} from "../src/models/index.js";

// All FIXTURE data. Nothing here proves a real record.
const KEY = "test-only-channel-key";
let api;
let source;
let ip = 0;
const lines = [];
const original = { log: console.log, warn: console.warn, error: console.error };

const headers = () => ({ "x-channel-key": KEY });
const web = (body, path = "check") => {
  ip += 1;
  return post(`${api.url}/v1/public/${path}`, body, { "x-forwarded-for": `198.51.${Math.floor(ip / 250)}.${ip % 250}` });
};
const bot = (body, path = "check") => post(`${api.url}/v1/public/${path}`, { channel: "whatsapp", sender_ref: "fixture-sender", ...body }, headers());
const webJson = async (body, path) => {
  const res = await web(body, path);
  assert.equal(res.status, path ? 202 : 200);
  return res.json();
};

async function entity(name, { allowFuzzy = false, type = "warning", extra = {}, domain, kind = "platform" } = {}) {
  const doc = await Entity.create({ name, slug: name.toLowerCase().replace(/\W+/g, "-"), kind, allowFuzzy });
  await Identifier.create({ entityId: doc._id, ...buildIdentifier("name", name), origin: "notice", allowFuzzy });
  if (domain) await Identifier.create({ entityId: doc._id, ...buildIdentifier("domain", domain), origin: "notice" });
  if (type) await Record.create({ entityId: doc._id, sourceId: source._id, type, quote: "Fixture", capturedBy: "a", reviewedBy: "b", status: "active", jurisdiction: "GH", ...extra });
  return doc;
}

before(async () => {
  process.env.CHANNEL_API_KEY = KEY;
  await startDb();
  api = await serve(createApp());
  for (const k of Object.keys(original)) {
    console[k] = (...args) => lines.push(args.join(" "));
  }
});

after(async () => {
  Object.assign(console, original);
  await api.close();
  await stopDb();
});

beforeEach(async () => {
  process.env.CHANNEL_API_KEY = KEY;
  process.env.PUBLIC_DAILY_LIMIT = "20";
  await Promise.all([Entity, Identifier, Record, Source, PublicReport, Appeal, SenderDay, Check, Case, Merchant, Contribution].map((m) => m.deleteMany({})));
  source = await Source.create({ publisher: "Fixture Regulator", type: "notice", title: "Fixture notice", url: "https://example.test/n", publishedOn: new Date("2026-07-01") });
});

/* --- Your two examples --------------------------------------------- */

test("a message with a link to a notice-listed site finds the notice", async () => {
  await entity("Fixture Scheme", { domain: "fixture-scheme.test" });
  const body = await webJson({ text: "Earn 5% a day at https://www.fixture-scheme.test/join now", urls: [] });
  assert.equal(body.state, "named_in_notice");
  assert.equal(body.tier, 1);
  assert.equal(body.entity, "Fixture Scheme");
  assert.equal(body.report.return_check.annual_percent, 1825);
});

test("the same link in the urls field works", async () => {
  await entity("Fixture Scheme", { domain: "fixture-scheme.test" });
  const body = await webJson({ urls: ["https://fixture-scheme.test"] });
  assert.equal(body.state, "named_in_notice");
});

test("app1e as a name suggests Apple", async () => {
  await entity("Apple", { allowFuzzy: true, type: "licence", extra: { licenseType: "Fixture" }, kind: "company" });
  const body = await webJson({ recipient: "app1e", type: "name" });
  assert.equal(body.match, false);
  assert.equal(body.did_you_mean.suggested_entity, "Apple");
});

test("app1e inside a message suggests Apple", async () => {
  await entity("Apple", { allowFuzzy: true, type: "licence", extra: { licenseType: "Fixture" }, kind: "company" });
  const body = await webJson({ text: "Send your money to App1e Ghana today" });
  assert.equal(body.match, false);
  assert.equal(body.state, "no_record");
  assert.equal(body.did_you_mean.suggested_entity, "Apple");
  assert.match(body.report.state_sentence, /Did you mean Apple\?/);
});

for (const domain of ["app1e.com", "https://www.app1e.com/login", "app1e-invest.com"]) {
  test(`the look-alike domain ${domain} suggests Apple`, async () => {
    await entity("Apple", { allowFuzzy: true, type: "licence", extra: { licenseType: "Fixture" }, domain: "apple.com", kind: "company" });
    const body = await webJson({ recipient: domain, type: "domain" });
    assert.equal(body.match, false);
    assert.equal(body.did_you_mean?.suggested_entity, "Apple");
  });
}

test("a look-alike domain in a message suggests the real name", async () => {
  await entity("Apple", { allowFuzzy: true, type: "licence", extra: { licenseType: "Fixture" }, domain: "apple.com", kind: "company" });
  const body = await webJson({ text: "Verify your account at app1e.com" });
  assert.equal(body.did_you_mean?.suggested_entity, "Apple");
});

test("the real domain matches, with no suggestion", async () => {
  await entity("Apple", { allowFuzzy: true, type: "licence", extra: { licenseType: "Fixture" }, domain: "apple.com", kind: "company" });
  const body = await webJson({ recipient: "apple.com", type: "domain" });
  assert.equal(body.state, "licensed");
  assert.equal(body.did_you_mean, null);
});

test("1 standing for i is caught", async () => {
  await entity("Micro Fund", { allowFuzzy: true, type: "licence", extra: { licenseType: "Fixture" } });
  assert.equal((await webJson({ recipient: "M1cro Fund", type: "name" })).did_you_mean?.suggested_entity, "Micro Fund");
});

test("no suggestions without allowFuzzy, or from unreviewed names", async () => {
  await entity("Apple", { allowFuzzy: false, type: "licence", extra: { licenseType: "Fixture" } });
  await entity("Orange Pending", { allowFuzzy: true, type: null });
  assert.equal((await webJson({ recipient: "app1e.com", type: "domain" })).did_you_mean, null);
  assert.equal((await webJson({ text: "pay App1e and 0range Pending" })).did_you_mean, null);
});

test("Daraz in a message doesn't suggest Darazz", async () => {
  await entity("Darazz", { allowFuzzy: true });
  const body = await webJson({ text: "I bought it on Daraz yesterday" });
  assert.equal(body.did_you_mean, null);
  assert.equal(body.match, false);
});

test("an ordinary mention of a word is not a look-alike", async () => {
  await entity("Apple", { allowFuzzy: true, type: "licence", extra: { licenseType: "Fixture" } });
  assert.equal((await webJson({ text: "An apply form and a staple" })).did_you_mean, null);
});

/* --- Message handling ---------------------------------------------- */

test("the GoldWave offer: no record, the allowed sentence, return check, warning signs", async () => {
  const body = await webJson({ text: "GoldWave pays 5% a day, guaranteed. Refer 5 friends to earn more. Pay 0240000011." });
  assert.equal(body.match, false);
  assert.equal(body.state, "no_record");
  assert.match(body.report.state_sentence, /This does not mean it is safe or unsafe\./);
  assert.equal(body.report.return_check.annual_percent, 1825);
  assert.match(body.report.return_check.note, /about 1,825% a year/);
  assert.ok(body.report.warning_signs.length >= 2);
  assert.match(body.report.footer, /Information, not advice\./);
});

test("a named firm beside an unknown number leads with the number", async () => {
  await entity("Fixture Licensed", { type: "licence", extra: { licenseType: "Fund Manager" } });
  const body = await webJson({ text: "Invest with Fixture Licensed. Pay to 0240000012." });
  assert.equal(body.state, "no_record");
  assert.equal(body.entity, null);
  assert.equal(body.report.also_checked.length, 1);
  assert.match(body.report.also_checked[0], /Fixture Licensed/);
});

test("a notice outranks everything else in the message", async () => {
  await entity("Fixture Licensed", { type: "licence", extra: { licenseType: "Fund Manager" } });
  await entity("Fixture Scheme", { domain: "fixture-scheme.test" });
  const body = await webJson({ text: "Fixture Licensed partners with fixture-scheme.com. Pay 0240000012. Also Fixture Scheme." });
  assert.equal(body.state, "named_in_notice");
  assert.equal(body.entity, "Fixture Scheme");
  assert.ok(body.report.also_checked.length >= 2);
});

test("a regulator mentioned in a message doesn't become the result", async () => {
  await entity("SEC Fixture Regulator", { kind: "authority", type: null });
  const body = await webJson({ text: "Approved by SEC Fixture Regulator. Pay 0240000012." });
  assert.equal(body.state, "no_record");
});

test("a number advertised under a registered business opens a review, silently", async () => {
  const doc = await Entity.create({ name: "Fixture Shop Ltd", slug: "fixture-shop-ltd", kind: "merchant" });
  const till = await Identifier.create({ entityId: doc._id, ...buildIdentifier("momo_number", "+233240000020"), origin: "merchant" });
  const org = await Organization.create({ name: `Org ${Date.now()}`, type: "qwench", status: "demo" });
  const user = await User.create({ orgId: org._id, email: `r${Date.now()}@example.test`, role: "reviewer", passwordHash: "$2b$04$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu" });
  await Merchant.create({ entityId: doc._id, legalName: "Fixture Shop Ltd", officialIdentifiers: [till._id], status: "verified", verifiedBy: user._id });

  const body = await webJson({ text: "Pay Fixture Shop Ltd on 0240000021" });
  assert.equal(body.match, false);
  assert.equal(body.tier, null);
  assert.equal(await Case.countDocuments(), 1);
});

/* --- Links and images ----------------------------------------------- */

test("a link to an internal address isn't opened, and the check still answers", async () => {
  const body = await webJson({ urls: ["http://169.254.169.254/latest/meta-data/"] });
  assert.equal(body.state, "no_record");
  assert.ok(body.report.notes.some((n) => /could not be opened/.test(n)));
});

for (const [label, urls, type, value] of [
  ["Telegram", ["https://t.me/fixturegroup"], "telegram_link", "t.me/fixturegroup"],
  ["TikTok", ["https://www.tiktok.com/@fixturepage"], "tiktok_handle", "@fixturepage"],
]) {
  test(`a ${label} link is queued for a person, and not fetched`, async () => {
    const body = await webJson({ urls });
    assert.ok(body.report.notes.some((n) => /saved for a person/.test(n)));
    assert.ok(!body.report.notes.some((n) => /could not be opened/.test(n)));
    const report = await PublicReport.findOne({}).lean();
    assert.equal(report.identifiers[0].valueHash, hashIdentifier(type, buildIdentifier(type, value).normalized));
    assert.equal(report.reviewStatus, "pending");
    assert.ok(report.evidenceRefs[0].includes("fixture"));

    await webJson({ urls });
    assert.equal(await PublicReport.countDocuments(), 1);
  });
}

test("an image with no AI provider answers, and says it wasn't read", async () => {
  const body = await webJson({ image_base64: Buffer.from("fixture").toString("base64"), mime_type: "image/png" });
  assert.equal(body.state, "no_record");
  assert.ok(body.report.notes.some((n) => /image could not be read/.test(n)));
});

test("a message with no AI provider gets no note about AI", async () => {
  const body = await webJson({ text: "GoldWave" });
  assert.deepEqual(body.report.notes, []);
});

/* --- Reply shape ---------------------------------------------------- */

test("the reply has the agreed fields, and nothing else", async () => {
  const body = await webJson({ text: "GoldWave" });
  assert.deepEqual(Object.keys(body).sort(), ["checked_at", "did_you_mean", "entity", "is_demo", "match", "reason_codes", "report", "state", "tier"].sort());
});

test("a hidden number in a message looks exactly like an unknown one", async () => {
  const org = await Organization.create({ name: `Org ${Date.now()}x`, type: "bank", status: "demo" });
  await Contribution.create({ orgId: org._id, schemeName: "Hidden", identifiers: [{ type: "momo_number", valueHash: hashIdentifier("momo_number", "+233240000030") }], terms: "5% a day", reviewStatus: "reviewed" });
  const strip = ({ checked_at: _a, ...rest }) => ({ ...rest, report: JSON.parse(JSON.stringify(rest.report).replaceAll("0240000030", "X").replaceAll("0240000031", "X").replaceAll("+233240000030", "X").replaceAll("+233240000031", "X")) });
  const hidden = strip(await webJson({ text: "Pay 0240000030" }));
  const unknown = strip(await webJson({ text: "Pay 0240000031" }));
  assert.deepEqual(hidden, unknown);
});

/* --- Validation and body size --------------------------------------- */

for (const [label, body, reason] of [
  ["an empty body", {}, /send text/],
  ["blank text", { text: "  " }, /send text/],
  ["too much text", { text: "x".repeat(5001) }, /5000/],
  ["too many links", { urls: ["a", "b", "c", "d"] }, /up to 3/],
  ["a bad image type", { image_base64: "eA==", mime_type: "application/zip" }, /mime_type/],
  ["a bad channel", { text: "x", channel: "fax" }, /channel/],
  ["recipient with no type", { recipient: "x" }, /type/],
]) {
  test(`400: ${label}`, async () => {
    const res = await web(body);
    assert.equal(res.status, 400);
    assert.match((await res.json()).error.message, reason);
  });
}

test("an image-sized body is accepted on the public check only", async () => {
  const image = "a".repeat(2_000_000);
  assert.equal((await web({ image_base64: image, mime_type: "image/png" })).status, 200);
  const res = await web({ scheme_name: "x", evidence_urls: [], padding: image }, "reports");
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, "body_too_large");
});

/* --- Bots ------------------------------------------------------------ */

test("a bot needs the channel key", async () => {
  for (const [label, key] of [["missing", undefined], ["wrong", "nope"]]) {
    const res = await post(`${api.url}/v1/public/check`, { text: "x", channel: "telegram", sender_ref: "s" }, key ? { "x-channel-key": key } : {});
    assert.equal(res.status, 401, label);
    assert.equal((await res.json()).error.code, "invalid_channel_key");
  }
});

test("bots are refused when no channel key is configured", async () => {
  delete process.env.CHANNEL_API_KEY;
  const res = await post(`${api.url}/v1/public/check`, { text: "x", channel: "whatsapp", sender_ref: "s" }, { "x-channel-key": "" });
  assert.equal(res.status, 401);
});

test("a bot must say who the sender is", async () => {
  const res = await post(`${api.url}/v1/public/check`, { text: "x", channel: "whatsapp" }, headers());
  assert.equal(res.status, 400);
});

test("the fair-use limit stops one sender and not another", async () => {
  process.env.PUBLIC_DAILY_LIMIT = "2";
  assert.equal((await bot({ text: "a" })).status, 200);
  assert.equal((await bot({ text: "b" })).status, 200);
  const third = await bot({ text: "c" });
  assert.equal(third.status, 429);
  assert.equal((await third.json()).error.code, "daily_limit");
  assert.equal((await bot({ text: "a", sender_ref: "another-sender" })).status, 200);
});

test("the limit defaults to 20", async () => {
  delete process.env.PUBLIC_DAILY_LIMIT;
  for (let i = 0; i < 20; i += 1) assert.equal((await bot({ text: "a", sender_ref: "default-limit" })).status, 200);
  assert.equal((await bot({ text: "a", sender_ref: "default-limit" })).status, 429);
});

test("bots skip the per-IP limit, because they share one address", async () => {
  for (let i = 0; i < 35; i += 1) assert.equal((await bot({ text: "a", sender_ref: `sender-${i}` })).status, 200);
});

test("a sender is stored as a daily hash, with a 24-hour expiry", async () => {
  await bot({ text: "a", sender_ref: "+233249999999" });
  const row = await SenderDay.collection.findOne({});
  assert.match(row.senderHash, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(row).includes("233249999999"));
  const hours = (row.expiresAt - Date.now()) / 3600000;
  assert.ok(hours > 23.9 && hours <= 24);
});

test("nothing raw reaches the database or the log", async () => {
  lines.length = 0;
  await bot({ text: "Secret offer text. Pay 0240000040 at https://secret-offer.com", sender_ref: "+233249999998" });
  await new Promise((r) => setTimeout(r, 100));

  const stored = [];
  for (const m of [Check, SenderDay, PublicReport]) stored.push(...(await m.collection.find({}).toArray()));
  const all = `${JSON.stringify(stored)}\n${lines.join("\n")}`;
  for (const secret of ["Secret offer", "secret-offer", "0240000040", "233240000040", "233249999998"]) {
    assert.ok(!all.includes(secret), secret);
  }
  const row = await Check.collection.findOne({});
  assert.equal(row.channel, "whatsapp");
  assert.equal(row.identifierHashes.length, 2);
  assert.equal(row.createdAt, undefined);
});

/* --- Reports ---------------------------------------------------------- */

const REPORT = { scheme_name: "Fixture Reported", identifiers: [{ type: "momo_number", value: "0240000050" }], evidence_urls: ["https://example.test/post"] };

test("a report is saved hashed, and the thank-you has no count", async () => {
  const body = await webJson(REPORT, "reports");
  assert.deepEqual(body, { received: true, message: "Thank you. A person will review this." });
  const row = await PublicReport.collection.findOne({});
  assert.equal(row.reviewStatus, "pending");
  assert.equal(row.identifiers[0].valueHash, hashIdentifier("momo_number", "+233240000050"));
  assert.ok(!JSON.stringify(row).includes("0240000050"));
  assert.ok(row.expiresAt > new Date());
});

test("the reply doesn't change with what is already known", async () => {
  await webJson(REPORT, "reports");
  assert.deepEqual(await webJson(REPORT, "reports"), await webJson({ scheme_name: "Never Seen" }, "reports"));
});

test("a number typed into the scheme name isn't stored", async () => {
  await webJson({ scheme_name: "Pay Fixture on 024 000 0060 now" }, "reports");
  const row = await PublicReport.collection.findOne({});
  assert.ok(!/0060/.test(row.schemeName));
  assert.match(row.schemeName, /number removed/);
});

test("reports take no free text beyond the name", async () => {
  await webJson({ ...REPORT, description: "My cousin Ama lost money, her number is 0240000061" }, "reports");
  assert.ok(!JSON.stringify(await PublicReport.collection.findOne({})).includes("Ama"));
});

test("twenty reports from one source change nothing publicly, and are flagged", async () => {
  await entity("Fixture Reported", { type: null });
  const first = await webJson({ text: "Pay 0240000050" });
  for (let i = 0; i < 20; i += 1) await webJson(REPORT, "reports");
  const second = await webJson({ text: "Pay 0240000050" });
  const strip = ({ checked_at: _a, ...rest }) => rest;
  assert.deepEqual(strip(second), strip(first));
  assert.ok((await PublicReport.countDocuments({ volumeFlag: true })) >= 10);
});

test("reports against a registered merchant stay in review", async () => {
  await entity("Fixture Shop", { type: "registration" });
  for (let i = 0; i < 3; i += 1) await webJson({ scheme_name: "Fixture Shop" }, "reports");
  assert.equal(await PublicReport.countDocuments({ reviewStatus: "pending" }), 3);
  assert.equal((await webJson({ recipient: "Fixture Shop", type: "name" })).state, "registered");
});

test("a bot reports with its key, under the fair-use limit", async () => {
  process.env.PUBLIC_DAILY_LIMIT = "1";
  assert.equal((await bot(REPORT, "reports")).status, 202);
  assert.equal((await bot(REPORT, "reports")).status, 429);
  assert.equal((await PublicReport.findOne({})).source, "whatsapp");
});

/* --- Appeals ---------------------------------------------------------- */

const APPEAL = { type: "momo_number", value: "0240000070", contact: "fixture@example.test", reason: "This is my number" };

test("an appeal gets a due date, and its contact is encrypted", async () => {
  const body = await webJson(APPEAL, "appeals");
  assert.equal(body.received, true);
  assert.match(body.due_date, /^\d{4}-\d{2}-\d{2}$/);
  const row = await Appeal.collection.findOne({});
  assert.ok(!row.contact.includes("fixture@example.test"));
  assert.equal(row.identifierHash, hashIdentifier("momo_number", "+233240000070"));
  assert.ok(!JSON.stringify(row).includes("0240000070"));
});

test("an appeal reply never confirms or denies internal reports", async () => {
  const org = await Organization.create({ name: `Org ${Date.now()}y`, type: "bank", status: "demo" });
  await Contribution.create({ orgId: org._id, schemeName: "Hidden", identifiers: [{ type: "momo_number", valueHash: hashIdentifier("momo_number", "+233240000070") }], reviewStatus: "reviewed" });
  await PublicReport.create({ schemeName: "Hidden", identifiers: [{ type: "momo_number", valueHash: hashIdentifier("momo_number", "+233240000070") }], source: "web" });
  const strip = ({ reference: _r, ...rest }) => rest;
  assert.deepEqual(strip(await webJson(APPEAL, "appeals")), strip(await webJson({ ...APPEAL, value: "0240000071" }, "appeals")));
});

for (const field of ["type", "value", "contact", "reason"]) {
  test(`an appeal needs ${field}`, async () => {
    const { [field]: _removed, ...body } = APPEAL;
    assert.equal((await web(body, "appeals")).status, 400);
  });
}

/* --- About ------------------------------------------------------------- */

test("about gives the data date and reviewed record counts by source", async () => {
  await entity("Fixture One");
  await entity("Fixture Two", { type: "sandbox" });
  await entity("Fixture Pending", { type: "warning", extra: { status: "pending", reviewedBy: undefined } });
  await entity("Fixture Ended", { type: "sandbox", extra: { endsOn: new Date("2020-01-01") } });
  const demo = await Source.create({ publisher: "Qwench demo data", type: "notice", title: "Demo", publishedOn: new Date("2026-01-01"), isDemo: true });
  await entity("Fixture Demo", { extra: { sourceId: demo._id, isDemo: true } });

  const body = await (await fetch(`${api.url}/v1/public/about`, { headers: { "x-forwarded-for": "198.51.200.1" } })).json();
  assert.match(body.data_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(body.total_records, 2);
  assert.deepEqual(body.records_by_source, [{ publisher: "Fixture Regulator", records: 2 }]);
});

test("about with no records doesn't invent a date", async () => {
  const body = await (await fetch(`${api.url}/v1/public/about`, { headers: { "x-forwarded-for": "198.51.200.2" } })).json();
  assert.equal(body.data_date, null);
  assert.equal(body.total_records, 0);
});
