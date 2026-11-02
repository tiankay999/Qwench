import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { after, before, test } from "node:test";

import { post, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";
import {
  BrandFinding,
  Case,
  Contribution,
  Entity,
  Identifier,
  Merchant,
  Organization,
  Record,
  Source,
} from "../src/models/index.js";
import { DEMO_NUMBERS, seedDemo } from "../src/scripts/seed-demo.js";

let api;
let seeded;

before(async () => {
  await startDb();
  api = await serve(createApp());
});

after(async () => {
  await api.close();
  await stopDb();
});

test("refuses to run unless ALLOW_DEMO_SEED is true", async () => {
  delete process.env.ALLOW_DEMO_SEED;
  await assert.rejects(seedDemo(), /ALLOW_DEMO_SEED/);
  assert.equal(await Organization.countDocuments(), 0);

  for (const value of ["", "false", "1"]) {
    const run = spawnSync(process.execPath, ["src/scripts/seed-demo.js"], {
      env: { ...process.env, ALLOW_DEMO_SEED: value, MONGODB_URI: "" },
      encoding: "utf8",
      timeout: 30000,
    });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /no demo data was created/);
  }
});

test("creates labelled demo data of each kind", async () => {
  process.env.ALLOW_DEMO_SEED = "true";
  seeded = await seedDemo();

  for (const [Model, label] of [[Entity, "entity"], [Identifier, "identifier"], [Record, "record"], [Source, "source"], [Merchant, "merchant"], [Case, "case"], [BrandFinding, "finding"], [Contribution, "contribution"], [Organization, "organization"]]) {
    assert.ok((await Model.countDocuments()) > 0, label);
    assert.equal(await Model.countDocuments({ isDemo: { $ne: true } }), 0, `${label} not labelled`);
  }
  assert.equal(Object.keys(seeded.keys).length, 2);
});

test("demo numbers are obviously fake", () => {
  for (const number of Object.values(DEMO_NUMBERS)) assert.match(number, /^\+23324000000\d$/);
});

test("the partner number is stored as a hash only", async () => {
  const row = await Identifier.collection.findOne({ origin: "partner" });
  assert.equal(row.normalized, "");
  assert.equal(row.raw, "");
  const all = JSON.stringify(await Contribution.collection.find({}).toArray());
  assert.ok(!all.includes(DEMO_NUMBERS.partner));
});

test("no real bank, MoMo provider or regulator is named", () => {
  const source = fs.readFileSync("src/scripts/seed-demo.js", "utf8");
  for (const name of ["MTN", "Telecel", "AirtelTigo", "Ecobank", "GCB", "Stanbic", "Absa", "Fidelity", "Bank of Ghana", "SEC Ghana", "EOCO", "CSA"]) {
    assert.ok(!source.includes(name), name);
  }
  assert.ok(!/isOfficial: true/.test(source));
});

test("the demo source doesn't claim to be a regulator", async () => {
  const source = await Source.findOne({});
  assert.equal(source.isOfficial, false);
  assert.match(source.publisher, /demo/i);
  assert.match(source.title, /not a real/i);
});

test("the demo keys work, and a check finds the demo notice", async () => {
  const key = Object.values(seeded.keys)[0];
  const res = await post(`${api.url}/v1/check`, { recipient: DEMO_NUMBERS.notice, type: "momo_number" }, { "x-api-key": key });
  const body = await res.json();
  assert.equal(body.match, true);
  assert.equal(body.state, "named_in_notice");
  assert.equal(body.sources[0].publisher, "Qwench demo data");
});

test("running it again adds no duplicates, and replaces the keys", async () => {
  const counts = async () => [await Entity.countDocuments(), await Identifier.countDocuments(), await Record.countDocuments(), await Case.countDocuments(), await Contribution.countDocuments()];
  const first = await counts();
  const old = Object.values(seeded.keys)[0];
  const again = await seedDemo();
  assert.deepEqual(await counts(), first);

  const res = await post(`${api.url}/v1/check`, { recipient: "x", type: "name" }, { "x-api-key": old });
  assert.equal(res.status, 401);
  const fresh = await post(`${api.url}/v1/check`, { recipient: "x", type: "name" }, { "x-api-key": Object.values(again.keys)[0] });
  assert.equal(fresh.status, 200);
});

test("it refuses to overwrite real data with the same key", async () => {
  await Entity.create({ name: "Real Clash", slug: "real-clash", kind: "platform" });
  const { default: mongoose } = await import("mongoose");
  await Entity.updateOne({ slug: "demo-merchant-ltd" }, { isDemo: false });
  await assert.rejects(seedDemo(), /non-demo/);
  assert.ok(mongoose.connection.readyState);
  await Entity.updateOne({ slug: "demo-merchant-ltd" }, { isDemo: true });
});
