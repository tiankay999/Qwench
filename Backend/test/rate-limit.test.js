import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { makeApiKey, post, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";

let api;

before(async () => {
  await startDb();
  api = await serve(createApp());
});

after(async () => {
  await api.close();
  await stopDb();
});

async function assert429(res) {
  assert.equal(res.status, 429);
  const body = await res.json();
  assert.equal(body.error.code, "rate_limited");
}

test("429: a key over its own per-minute allowance, without affecting other keys", async () => {
  const small = await makeApiKey(["check"], { rateLimit: 2 });
  const other = await makeApiKey(["check"]);
  const send = (key) => post(`${api.url}/v1/check`, { recipient: "+233240000000", type: "momo_number" }, { "x-api-key": key });

  assert.equal((await send(small)).status, 200);
  assert.equal((await send(small)).status, 200);
  await assert429(await send(small));
  assert.equal((await send(other)).status, 200);
});

test("429: public route over 30 a minute", async () => {
  let last;
  for (let i = 0; i < 31; i += 1) {
    last = await post(`${api.url}/v1/public/check`, { recipient: "+233240000000", type: "momo_number" });
  }
  await assert429(last);
});
