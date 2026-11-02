import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { makeApiKey, post, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";
import { buildIdentifier } from "../src/lib/identifiers.js";
import { Entity, Identifier, Record, Source } from "../src/models/index.js";

// FIXTURE data. This proves the code path works with no AI provider, not that
// any real record is correct.
let api;
let key;

before(async () => {
  await startDb();
  api = await serve(createApp());
  key = await makeApiKey(["check"]);

  const source = await Source.create({ publisher: "Fixture publisher", type: "notice", title: "Fixture notice", publishedOn: new Date("2026-07-01") });
  const entity = await Entity.create({ name: "Fixture Scheme", slug: "fixture-scheme", kind: "platform" });
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("domain", "fixture-scheme.test") });
  await Record.create({ entityId: entity._id, sourceId: source._id, type: "warning", quote: "Fixture quote", capturedBy: "capturer", reviewedBy: "reviewer", status: "active" });
});

after(async () => {
  await api.close();
  await stopDb();
});

test("no AI key is set during the test run", () => {
  for (const name of ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY"]) assert.equal(process.env[name], undefined);
});

test("/v1/check returns a match with no AI provider", async () => {
  const res = await post(`${api.url}/v1/check`, { recipient: "fixture-scheme.test", type: "domain" }, { "x-api-key": key });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.match, true);
  assert.equal(body.state, "named_in_notice");
  assert.equal(body.tier, 1);
});

test("/v1/public/check returns a match with no AI provider", async () => {
  const res = await post(`${api.url}/v1/public/check`, { recipient: "fixture-scheme.test", type: "domain" });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).match, true);
});
