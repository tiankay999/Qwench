import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { makeApiKey, post, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";
import { Entity, Identifier, PublicReport, Record, Source } from "../src/models/index.js";
import { migrateLegacy } from "../src/scripts/migrate-legacy.js";

let api;
let key;

before(async () => {
  await startDb();
  api = await serve(createApp());
  key = await makeApiKey(["check"]);
});

after(async () => {
  await api.close();
  await stopDb();
});

test("every legacy record lands pending, with no quote or link", async () => {
  const report = await migrateLegacy();
  assert.equal(report.records, 79);
  assert.equal(await Record.countDocuments(), 79);
  assert.equal(await Record.countDocuments({ status: "pending" }), 79);
  assert.equal(await Record.countDocuments({ quote: { $exists: true } }), 0);
  assert.equal(await Source.countDocuments({ url: { $exists: true } }), 0);
  assert.equal(await Source.countDocuments({ isOfficial: true }), 0);
  assert.equal(await Identifier.countDocuments({ allowFuzzy: true }), 0);
});

test("running it again adds nothing, and doesn't undo a review", async () => {
  const before = [await Entity.countDocuments(), await Identifier.countDocuments(), await Record.countDocuments()];

  const reviewed = await Record.findOne({ type: "warning" });
  reviewed.set({ status: "active", quote: "Fixture quote", reviewedBy: "fixture reviewer" });
  await reviewed.save();

  const report = await migrateLegacy();
  assert.equal(report.entities + report.identifiers + report.records, 0);
  assert.deepEqual([await Entity.countDocuments(), await Identifier.countDocuments(), await Record.countDocuments()], before);
  assert.equal((await Record.findById(reviewed._id)).status, "active");

  reviewed.set({ status: "withdrawn" });
  await reviewed.save();
});

test("names on the legacy list are never returned by a check", async () => {
  await Record.updateMany({ status: "withdrawn" }, { status: "pending" });
  for (const [recipient, type] of [
    ["Menzgold Ghana Limited", "name"],
    ["Databank Financial Services", "name"],
    ["AFRICOIN", "name"],
  ]) {
    const res = await post(`${api.url}/v1/check`, { recipient, type }, { "x-api-key": key });
    const body = await res.json();
    assert.equal(body.match, false, recipient);
    assert.equal(body.state, "no_record", recipient);
    assert.equal(body.tier, null, recipient);
  }
});

test("it brings in no public reports", async () => {
  assert.equal(await PublicReport.countDocuments(), 0);
});
