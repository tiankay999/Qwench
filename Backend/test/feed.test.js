import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

import { makeApiKey, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";
import { buildIdentifier, hashIdentifier } from "../src/lib/identifiers.js";
import { ApiKey, Contribution, Entity, Identifier, Organization, Record, Source, generateApiKey } from "../src/models/index.js";

// All FIXTURE data.
let api;
let key;
let source;
let n = 0;

before(async () => {
  await startDb();
  api = await serve(createApp());
  key = await makeApiKey(["feed", "check"]);
});

after(async () => {
  await api.close();
  await stopDb();
});

beforeEach(async () => {
  await Promise.all([Entity, Identifier, Record, Source, Contribution].map((m) => m.deleteMany({})));
  source = await Source.create({ publisher: "Fixture Regulator", type: "notice", title: "Fixture notice", url: "https://example.test/n", publishedOn: new Date("2026-07-01") });
});

async function record(name, extra = {}, entityExtra = {}) {
  n += 1;
  const entity = await Entity.create({ name, slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${n}`, kind: "platform", ...entityExtra });
  const doc = await Record.create({ entityId: entity._id, sourceId: source._id, type: "warning", quote: "Fixture quote", capturedBy: "a", reviewedBy: "b", status: "active", ...extra });
  return { entity, record: doc };
}

const feed = async (query = "", k = key) => {
  const res = await fetch(`${api.url}/v1/feed${query}`, { headers: { "x-api-key": k } });
  assert.equal(res.status, 200);
  return res.json();
};

test("a new record is added, with its source and quote", async () => {
  await record("Fixture One");
  const { records } = await feed();
  assert.equal(records.length, 1);
  assert.equal(records[0].change, "added");
  assert.equal(records[0].entity, "Fixture One");
  assert.equal(records[0].state, "named_in_notice");
  assert.equal(records[0].source.url, "https://example.test/n");
  assert.equal(records[0].quote, "Fixture quote");
  assert.equal(records[0].is_demo, false);
});

test("since is optional, and limits to what changed after it", async () => {
  await record("Fixture Old");
  const cutoff = new Date(Date.now() + 5).toISOString();
  await new Promise((r) => setTimeout(r, 10));
  await record("Fixture New");
  assert.equal((await feed()).records.length, 2);
  const { records } = await feed(`?since=${encodeURIComponent(cutoff)}`);
  assert.deepEqual(records.map((r) => r.entity), ["Fixture New"]);
});

test("a changed record is updated", async () => {
  const { record: doc } = await record("Fixture Changed");
  const cutoff = new Date(Date.now() + 5).toISOString();
  await new Promise((r) => setTimeout(r, 10));
  doc.quote = "Corrected";
  await doc.save();
  const { records } = await feed(`?since=${encodeURIComponent(cutoff)}`);
  assert.equal(records[0].change, "updated");
  assert.equal(records[0].quote, "Corrected");
});

for (const status of ["withdrawn", "expired"]) {
  test(`a ${status} record is removed, with no quote or identifiers`, async () => {
    const { record: doc, entity } = await record("Fixture Gone");
    await Identifier.create({ entityId: entity._id, ...buildIdentifier("domain", "gone.test"), origin: "notice" });
    const cutoff = new Date(Date.now() + 5).toISOString();
    await new Promise((r) => setTimeout(r, 10));
    doc.status = status;
    await doc.save();
    const { records } = await feed(`?since=${encodeURIComponent(cutoff)}`);
    assert.equal(records[0].change, "removed");
    assert.equal(records[0].quote, undefined);
    assert.deepEqual(records[0].identifiers, []);
  });
}

test("a record past its end date is removed", async () => {
  await record("Fixture Ended", { endsOn: new Date("2020-01-01") });
  assert.equal((await feed()).records[0].change, "removed");
});

test("a record approved after the cutoff counts as added", async () => {
  const { entity } = await record("Fixture Base", { status: "pending", reviewedBy: undefined });
  const doc = await Record.findOne({ entityId: entity._id });
  const cutoff = new Date(Date.now() + 5).toISOString();
  await new Promise((r) => setTimeout(r, 10));
  doc.set({ status: "active", reviewedBy: "b" });
  await doc.save();
  assert.equal((await feed(`?since=${encodeURIComponent(cutoff)}`)).records[0].change, "added");
});

test("pending records never appear", async () => {
  await record("Fixture Pending", { status: "pending", reviewedBy: undefined });
  assert.equal((await feed()).records.length, 0);
});

test("identifiers published in the notice are included", async () => {
  const { entity } = await record("Fixture Ids");
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("domain", "ids.test"), origin: "notice" });
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("momo_number", "+233240000000"), origin: "notice" });
  const { records } = await feed();
  assert.deepEqual(records[0].identifiers.sort((a, b) => a.type.localeCompare(b.type)), [
    { type: "domain", value: "ids.test" },
    { type: "momo_number", value: "+233240000000" },
  ]);
});

test("partner numbers never appear, in any form", async () => {
  const { entity } = await record("Fixture Partner");
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("momo_number", "+233240000001"), origin: "partner" });
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("momo_number", "+233240000002"), origin: "merchant" });
  const org = await Organization.create({ name: `Partner Org ${n}`, type: "bank", status: "demo" });
  await Contribution.create({ orgId: org._id, schemeName: "Fixture Partner", identifiers: [{ type: "momo_number", valueHash: hashIdentifier("momo_number", "+233240000001") }], reviewStatus: "reviewed" });

  for (const format of ["json", "csv"]) {
    const res = await fetch(`${api.url}/v1/feed?format=${format}`, { headers: { "x-api-key": key } });
    const body = await res.text();
    for (const secret of ["233240000001", "233240000002", hashIdentifier("momo_number", "+233240000001"), org.name, String(org._id)]) {
      assert.ok(!body.includes(secret), `${format}: ${secret}`);
    }
  }
});

test("cursor paging walks every record exactly once", async () => {
  for (let i = 0; i < 5; i += 1) await record(`Fixture Page ${i}`);
  const seen = [];
  let cursor = "";
  for (let i = 0; i < 6; i += 1) {
    const page = await feed(`?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    seen.push(...page.records.map((r) => r.entity));
    cursor = page.next_cursor;
    if (!cursor) break;
  }
  assert.equal(seen.length, 5);
  assert.equal(new Set(seen).size, 5);
});

test("records saved in the same millisecond aren't skipped", async () => {
  const when = new Date("2026-08-01T00:00:00.000Z");
  for (let i = 0; i < 3; i += 1) await record(`Fixture Tie ${i}`);
  await Record.collection.updateMany({}, { $set: { updatedAt: when } });
  const first = await feed("?limit=1");
  const second = await feed(`?limit=1&cursor=${encodeURIComponent(first.next_cursor)}`);
  const third = await feed(`?limit=1&cursor=${encodeURIComponent(second.next_cursor)}`);
  assert.equal(new Set([first, second, third].map((p) => p.records[0].entity)).size, 3);
});

test("a bad cursor or date is a 400", async () => {
  for (const query of ["?cursor=not-a-cursor", "?since=yesterday", "?format=xml", "?limit=0"]) {
    const res = await fetch(`${api.url}/v1/feed${query}`, { headers: { "x-api-key": key } });
    assert.equal(res.status, 400, query);
  }
});

test("csv has the same records, and neutralises spreadsheet formulas", async () => {
  await record("=HYPERLINK(1)");
  const res = await fetch(`${api.url}/v1/feed?format=csv`, { headers: { "x-api-key": key } });
  assert.match(res.headers.get("content-type"), /text\/csv/);
  const [header, row] = (await res.text()).split("\n");
  assert.match(header, /change/);
  assert.match(row, /"added"/);
  assert.match(row, /"'=HYPERLINK/);
});

test("demo records go only to demo organisations", async () => {
  await record("Fixture Real");
  await record("Fixture Demo", { isDemo: true }, { isDemo: true });

  const org = await Organization.create({ name: `Demo Real ${n}`, type: "bank", status: "active" });
  const realKey = generateApiKey({ live: false });
  await ApiKey.create({ orgId: org._id, keyHash: realKey.keyHash, prefix: realKey.prefix, scopes: ["feed"] });
  assert.deepEqual((await feed("", realKey.rawKey)).records.map((r) => r.entity), ["Fixture Real"]);
});

test("a demo organisation sees demo records, labelled", async () => {
  await record("Fixture Demo", { isDemo: true }, { isDemo: true });
  const org = await Organization.create({ name: `Demo Org ${n}`, type: "bank", status: "demo" });
  const k = generateApiKey({ live: false });
  await ApiKey.create({ orgId: org._id, keyHash: k.keyHash, prefix: k.prefix, scopes: ["feed"] });
  const { records } = await feed("", k.rawKey);
  assert.equal(records[0].is_demo, true);
});

test("using a key records when it was last used", async () => {
  const k = await makeApiKey(["feed"]);
  await feed("", k);
  let row;
  for (let i = 0; i < 50; i += 1) {
    row = await ApiKey.findOne({ keyHash: (await import("../src/models/index.js")).hashApiKey(k) }).lean();
    if (row.lastUsedAt) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.ok(row.lastUsedAt);
});
