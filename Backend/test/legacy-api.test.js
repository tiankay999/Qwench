import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { post, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";
import apiRoutes from "../src/routes/api.js";

// The bot still depends on /api, so it has to keep working until Phase 6.
let api;

before(async () => {
  await startDb();
  api = await serve(createApp());
});

after(async () => {
  await api.close();
  await stopDb();
});

test("every /api route is still registered", () => {
  const routes = apiRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);

  assert.deepEqual(routes.sort(), [
    "GET /crypto/trending",
    "GET /register",
    "GET /reports",
    "GET /stats",
    "GET /trending",
    "POST /check",
    "POST /evidence/image",
    "POST /evidence/url",
    "POST /report",
    "POST /verify-name",
  ]);
});

for (const path of ["/api/reports", "/api/trending", "/api/register", "/api/stats"]) {
  test(`GET ${path} keeps its existing response shape`, async () => {
    const res = await fetch(api.url + path);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
  });
}

for (const path of ["/api/check", "/api/verify-name", "/api/evidence/image", "/api/evidence/url", "/api/report"]) {
  test(`POST ${path} still rejects an empty body in its existing shape`, async () => {
    const res = await post(api.url + path, {});
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(typeof body.error, "string");
  });
}

test("an unknown /api route keeps its existing error shape", async () => {
  const res = await fetch(`${api.url}/api/nope`);
  assert.equal(res.status, 404);
  assert.equal(typeof (await res.json()).error, "string");
});

test("/health answers with no AI provider configured", async () => {
  const res = await fetch(`${api.url}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.llm.connected, false);
});
