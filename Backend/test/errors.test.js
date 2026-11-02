import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { makeApiKey, post, serve, startDb, stopDb } from "./helpers/setup.js";
import express from "express";
import { createApp } from "../src/app.js";
import { errorHandler } from "../src/middleware/errorHandler.js";

let api;
let key;

before(async () => {
  await startDb();
  api = await serve(createApp());
  key = await makeApiKey(["check", "cases"]);
});

after(async () => {
  await api.close();
  await stopDb();
});

async function assertV1Error(res, status, code) {
  assert.equal(res.status, status);
  const body = await res.json();
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.deepEqual(Object.keys(body.error).sort(), ["code", "message"]);
  assert.equal(typeof body.error.message, "string");
  assert.equal(body.error.code, code);
  return body;
}

test("400: failed validation", async () => {
  const res = await post(`${api.url}/v1/check`, { type: "name" }, { "x-api-key": key });
  await assertV1Error(res, 400, "invalid_input");
});

test("400: malformed JSON, without repeating the input", async () => {
  const secret = "+233240000000 send money";
  const res = await post(`${api.url}/v1/check`, secret, { "x-api-key": key });
  const body = await assertV1Error(res, 400, "invalid_json");
  assert.ok(!JSON.stringify(body).includes("233240000000"));
});

test("400: malformed JSON is not written to the log", async () => {
  const original = console.error;
  const lines = [];
  console.error = (...args) => lines.push(args.join(" "));
  try {
    await post(`${api.url}/v1/check`, "+233240000000 send money", { "x-api-key": key });
  } finally {
    console.error = original;
  }
  assert.ok(lines.length > 0);
  assert.ok(!lines.join("\n").includes("233240000000"));
});

test("401: missing key", async () => {
  await assertV1Error(await post(`${api.url}/v1/check`, {}), 401, "api_key_required");
});

test("401: unknown key", async () => {
  await assertV1Error(await post(`${api.url}/v1/check`, {}, { "x-api-key": "qw_test_nope" }), 401, "invalid_api_key");
});

test("401: revoked key", async () => {
  const revoked = await makeApiKey(["check"], { revokedAt: new Date() });
  await assertV1Error(await post(`${api.url}/v1/check`, {}, { "x-api-key": revoked }), 401, "invalid_api_key");
});

test("403: key without the scope", async () => {
  const res = await fetch(`${api.url}/v1/feed?since=2026-01-01`, { headers: { "x-api-key": key } });
  await assertV1Error(res, 403, "insufficient_scope");
});

test("404: unknown /v1 route, on the public and institutional sides", async () => {
  await assertV1Error(await fetch(`${api.url}/v1/public/nope`), 404, "not_found");
  const res = await fetch(`${api.url}/v1/nope`, { headers: { "x-api-key": key } });
  await assertV1Error(res, 404, "not_found");
});

test("404: unknown case", async () => {
  const res = await fetch(`${api.url}/v1/cases/QW-0000-0000`, { headers: { "x-api-key": key } });
  await assertV1Error(res, 404, "case_not_found");
});

test("500: hides internals and logs no error message", async () => {
  const app = express();
  app.get("/v1/boom", () => {
    throw new Error("E11000 dup key: { phone: +233240000000 }");
  });
  app.use(errorHandler);
  const server = await serve(app);

  const original = console.error;
  const lines = [];
  console.error = (...args) => lines.push(args.join(" "));
  try {
    const body = await assertV1Error(await fetch(`${server.url}/v1/boom`), 500, "internal_error");
    assert.equal(body.error.message, "Internal server error");
  } finally {
    console.error = original;
    await server.close();
  }
  assert.ok(!lines.join("\n").includes("233240000000"));
});

test("a status outside the agreed list is reported as 400", async () => {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/v1/x", (_req, res) => res.json({}));
  app.use(errorHandler);
  const server = await serve(app);
  try {
    await assertV1Error(await post(`${server.url}/v1/x`, { text: "a".repeat(2000) }), 400, "body_too_large");
  } finally {
    await server.close();
  }
});

test("security headers are set", async () => {
  const res = await fetch(`${api.url}/health`);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
});
