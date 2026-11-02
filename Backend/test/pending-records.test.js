import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { makeApiKey, post, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";
import { buildIdentifier } from "../src/lib/identifiers.js";
import { Entity, Identifier, Record, Source } from "../src/models/index.js";

// FIXTURE data. A record nobody has reviewed must never reach a caller.
let api;
let key;

const NAME = "Pending Fixture Scheme";
const DOMAIN = "pending-fixture.test";

before(async () => {
  await startDb();
  api = await serve(createApp());
  key = await makeApiKey(["check"]);

  const source = await Source.create({ publisher: "Fixture publisher", type: "register", title: "Fixture list", publishedOn: new Date("2026-07-01") });
  const entity = await Entity.create({ name: NAME, slug: "pending-fixture-scheme", kind: "platform" });
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("name", NAME), origin: "legacy" });
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("domain", DOMAIN), origin: "legacy" });
  await Record.create({ entityId: entity._id, sourceId: source._id, type: "warning", capturedBy: "migration:legacy" });
});

after(async () => {
  await api.close();
  await stopDb();
});

function assertNoRecord(body) {
  assert.equal(body.match, false);
  assert.equal(body.state, "no_record");
  assert.equal(body.tier, null);
  assert.ok(!JSON.stringify(body).includes(NAME));
}

for (const [label, recipient, type] of [
  ["domain", DOMAIN, "domain"],
  ["exact name", NAME, "name"],
]) {
  test(`pending only, by ${label}: public check returns no record`, async () => {
    const res = await post(`${api.url}/v1/public/check`, { recipient, type });
    assertNoRecord(await res.json());
  });

  test(`pending only, by ${label}: institution check returns no record`, async () => {
    const res = await post(`${api.url}/v1/check`, { recipient, type }, { "x-api-key": key });
    assertNoRecord(await res.json());
  });
}

test("pending only: /api/check returns no record", async () => {
  const res = await post(`${api.url}/api/check`, { query: DOMAIN });
  assertNoRecord((await res.json()).data);
});
