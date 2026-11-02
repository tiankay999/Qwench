import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, test } from "node:test";

import { makeApiKey, post, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";
import { AuditLog, Entity, Identifier, Record, Source } from "../src/models/index.js";
import { importReviewed, validateRow } from "../src/scripts/import-reviewed.js";

// FIXTURE data. These prove the import, not any real record.
const FIXTURES = path.join(import.meta.dirname, "fixtures/reviewed");
const goodRow = () => JSON.parse(fs.readFileSync(path.join(FIXTURES, "rows.json"), "utf8"))[0];

let api;
let key;

function tempDir(rows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qwench-import-"));
  fs.writeFileSync(path.join(dir, "rows.json"), typeof rows === "string" ? rows : JSON.stringify(rows));
  return dir;
}

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
  await Promise.all([Entity.deleteMany({}), Identifier.deleteMany({}), Record.deleteMany({}), Source.deleteMany({})]);
});

test("loads rows as active records, with hash-matchable identifiers", async () => {
  const report = await importReviewed({ dir: FIXTURES });
  assert.deepEqual(report.added.sort(), ["Darazz", "Fixture Notice Scheme"]);
  assert.equal(report.rejected.length, 0);

  const record = await Record.findOne({ quote: /Fixture quote, not/ });
  assert.equal(record.status, "active");
  assert.equal(record.reviewedBy, "fixture reviewer");
  assert.ok(record.reviewedAt);
  assert.equal(await AuditLog.countDocuments({ action: "record.import", target: `Record:${record._id}` }), 1);

  const res = await post(`${api.url}/v1/check`, { recipient: "0240000000", type: "momo_number" }, { "x-api-key": key });
  const body = await res.json();
  assert.equal(body.match, true);
  assert.equal(body.state, "named_in_notice");
  assert.equal(body.tier, 1);
  assert.equal(body.sources[0].url, "https://example.test/notice");
});

test("a number published in a notice stays readable, in +233 format", async () => {
  await importReviewed({ dir: FIXTURES });
  const row = await Identifier.findOne({ type: "momo_number" }).lean();
  assert.equal(row.normalized, "+233240000000");
  assert.equal(row.origin, "notice");
});

test("Daraz does not match a Darazz record", async () => {
  await importReviewed({ dir: FIXTURES });
  const res = await post(`${api.url}/v1/check`, { recipient: "Daraz", type: "name" }, { "x-api-key": key });
  const body = await res.json();
  assert.equal(body.match, false);
  assert.equal(body.state, "no_record");
});

test("running it twice adds and changes nothing", async () => {
  await importReviewed({ dir: FIXTURES });
  const counts = async () => [await Entity.countDocuments(), await Identifier.countDocuments(), await Record.countDocuments(), await Source.countDocuments()];
  const first = await counts();

  const second = await importReviewed({ dir: FIXTURES });
  assert.deepEqual(second.added, []);
  assert.deepEqual(second.changed, []);
  assert.equal(second.unchanged.length, 2);
  assert.deepEqual(await counts(), first);
});

test("an edited row is reported as changed and audited", async () => {
  await importReviewed({ dir: tempDir([goodRow()]) });
  const report = await importReviewed({ dir: tempDir([{ ...goodRow(), quote: "Corrected fixture quote." }]) });
  assert.deepEqual(report.changed, ["Fixture Notice Scheme"]);
  const record = await Record.findOne({});
  assert.equal(record.quote, "Corrected fixture quote.");
  assert.equal(await AuditLog.countDocuments({ target: `Record:${record._id}` }), 2);
});

test("a row whose end date has passed loads as expired", async () => {
  await importReviewed({ dir: tempDir([{ ...goodRow(), endsOn: "2020-01-01" }]) });
  assert.equal((await Record.findOne({})).status, "expired");
});

test("a withdrawn record is not brought back by an import", async () => {
  await importReviewed({ dir: tempDir([goodRow()]) });
  const record = await Record.findOne({});
  record.status = "withdrawn";
  await record.save();
  const report = await importReviewed({ dir: tempDir([goodRow()]) });
  assert.match(report.rejected[0].reasons[0], /withdrawn/);
  assert.equal((await Record.findOne({})).status, "withdrawn");
});

const without = (field) => {
  const row = goodRow();
  delete row[field];
  return row;
};
const withSource = (field) => {
  const row = goodRow();
  delete row.source[field];
  return row;
};

for (const [label, row, reason] of [
  ["no name", without("name"), /name/],
  ["no quote", without("quote"), /quote/],
  ["a blank quote", { ...goodRow(), quote: "  " }, /quote/],
  ["no effective date", without("effectiveOn"), /effectiveOn/],
  ["a bad effective date", { ...goodRow(), effectiveOn: "July 2026" }, /effectiveOn/],
  ["no source", without("source"), /source\.publisher/],
  ["no source link", withSource("url"), /source\.url/],
  ["a non-link source", { ...goodRow(), source: { ...goodRow().source, url: "SEC website" } }, /source\.url/],
  ["no publication date", withSource("publishedOn"), /publishedOn/],
  ["no capturer", without("capturedBy"), /capturedBy/],
  ["no reviewer", without("reviewedBy"), /reviewedBy/],
  ["the same capturer and reviewer", { ...goodRow(), capturedBy: "Ama", reviewedBy: " ama " }, /different person/],
  ["an unknown record type", { ...goodRow(), recordType: "scam" }, /recordType/],
  ["a licence with no type", { ...goodRow(), recordType: "licence" }, /licenseType/],
  ["a bad number", { ...goodRow(), identifiers: [{ type: "momo_number", raw: "12345" }] }, /\+233/],
  ["the GoldWave name", { ...goodRow(), name: "Gold Wave" }, /GoldWave/],
]) {
  test(`rejects a row with ${label}, and writes nothing`, async () => {
    assert.ok(validateRow(row).length > 0);
    const report = await importReviewed({ dir: tempDir([row]) });
    assert.equal(report.added.length, 0);
    assert.match(report.rejected[0].reasons.join(" "), reason);
    assert.equal(await Record.countDocuments(), 0);
    assert.equal(await Entity.countDocuments(), 0);
  });
}

test("one bad row doesn't stop the good ones", async () => {
  const report = await importReviewed({ dir: tempDir([goodRow(), without("quote")]) });
  assert.deepEqual(report.added, ["Fixture Notice Scheme"]);
  assert.equal(report.rejected.length, 1);
});

test("a file that isn't JSON is reported", async () => {
  const report = await importReviewed({ dir: tempDir("not json") });
  assert.deepEqual(report.rejected[0].reasons, ["not valid JSON"]);
});

test("a dry run writes nothing", async () => {
  await importReviewed({ dir: FIXTURES, dryRun: true });
  assert.equal(await Record.countDocuments(), 0);
  assert.equal(await Entity.countDocuments(), 0);
});

test("an empty folder is not an error", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qwench-import-"));
  const report = await importReviewed({ dir });
  assert.equal(report.files, 0);
});

test("the fixtures never contain GoldWave", () => {
  assert.ok(!/gold\s*wave/i.test(fs.readFileSync(path.join(FIXTURES, "rows.json"), "utf8")));
});
