import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { after, before, test } from "node:test";

const calls = [];
let next = { status: 200, body: {} };
const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (d) => (raw += d));
  req.on("end", () => {
    calls.push({ path: req.url, key: req.headers["x-channel-key"], body: JSON.parse(raw || "{}") });
    res.writeHead(next.status, { "content-type": "application/json" });
    res.end(JSON.stringify(next.body));
  });
});

const REPORT = {
  evidence_level: { code: "regulator_warning", label: "Regulator warning", meaning: "A Ghana regulator or sanctions list has named this." },
  disclaimer: "This is not a final ruling.",
  state_sentence: "Fixture Regulator named Fixture Scheme in a notice dated 2026-07-01.",
  foreign_context: [],
  also_checked: ["+233240000011: No record found."],
  sources: [{ publisher: "Fixture Regulator", date: "2026-07-01", url: "https://example.test/n" }],
  return_check: { stated: "5% a day", annual_percent: 1825, note: "That is about 1,825% a year." },
  warning_signs: ["The message promises guaranteed returns."],
  ai_warning_signs: ["The image seems to have faint or hidden text."],
  link_facts: ["The link first.com leads to second.com."],
  questions_to_ask: ["Has anyone asked you to recruit others?"],
  notes: ["Read from an image by AI. Please confirm the details."],
  footer: "SEC Ghana 0800 100 065. Information, not advice.",
};
const reply = (extra = {}) => ({ state: "named_in_notice", report: REPORT, did_you_mean: null, is_demo: false, ...extra });

let routeMessage, messages;
let id = 0;

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.API_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.CHANNEL_API_KEY = "fixture-key";
  const log = console.log;
  console.log = () => {};
  ({ routeMessage } = await import("../src/router.js"));
  messages = await import("../src/messages.js");
  console.log = log;
});
after(() => server.close());

/** A new user who has already had the welcome. */
async function user() {
  const jid = `user${++id}@s.whatsapp.net`;
  await routeMessage({ jid, send: async () => {} }, "hi");
  calls.length = 0;
  return async (text, media) => {
    const out = [];
    await routeMessage({ jid, send: async (m) => void out.push(m) }, text, media);
    return out;
  };
}

test("a whole message goes to /v1 with the key and sender, and the report comes back in order", async () => {
  next = { status: 200, body: reply() };
  const say = await user();
  const [checking, text] = await say("GoldWave pays 5% a day. Pay 0240000011");
  assert.equal(checking, messages.CHECKING);
  assert.equal(calls[0].path, "/v1/public/check");
  assert.equal(calls[0].key, "fixture-key");
  assert.equal(calls[0].body.text, "GoldWave pays 5% a day. Pay 0240000011");
  assert.equal(calls[0].body.channel, "whatsapp");
  assert.match(calls[0].body.sender_ref, /^whatsapp:user/);
  let last = -1;
  for (const part of ["Regulator warning", "named Fixture Scheme", "Sources", "Also checked", "Stated return", "Warning signs", "Spotted by AI", "About the link", "Questions to ask", "Read from an image", "not a final ruling", "Information, not advice"]) {
    const at = text.indexOf(part);
    assert.ok(at > last, part);
    last = at;
  }
});

test("a screenshot goes straight to the API, with or without a caption", async () => {
  next = { status: 200, body: reply() };
  const say = await user();
  await say("", { base64: "abc", mimeType: "image/png" });
  assert.equal(calls[0].body.image_base64, "abc");
  assert.equal(calls[0].body.mime_type, "image/png");
  assert.equal(calls[0].body.text, undefined);
});

test("demo data says so first", () => {
  assert.ok(messages.formatReply(reply({ is_demo: true })).startsWith("*DEMO DATA*"));
});

test("a suggested name is only checked if the person says yes", async () => {
  next = { status: 200, body: reply({ did_you_mean: { suggested_entity: "Fixture Scheme" } }) };
  const say = await user();
  const [, text] = await say("Fixtur Scheme");
  assert.match(text, /Did you mean \*Fixture Scheme\*\?/);
  next = { status: 200, body: reply() };
  await say("yes");
  assert.equal(calls[1].body.text, "Fixture Scheme");
});

test("anything but yes is a new check, not the suggestion", async () => {
  next = { status: 200, body: reply({ did_you_mean: { suggested_entity: "Fixture Scheme" } }) };
  const say = await user();
  await say("Fixtur Scheme");
  next = { status: 200, body: reply() };
  await say("Other Name");
  assert.equal(calls[1].body.text, "Other Name");
});

test("a report goes to /v1 and shows the API's thanks, with no count", async () => {
  next = { status: 202, body: { received: true, message: "Thank you. A person will review this." } };
  const say = await user();
  assert.deepEqual(await say("report"), [messages.REPORT_ASK_NAME]);
  assert.deepEqual(await say("Fixture Scheme"), ["Thank you. A person will review this."]);
  assert.equal(calls[0].path, "/v1/public/reports");
  assert.equal(calls[0].body.scheme_name, "Fixture Scheme");
});

test("a report can be cancelled", async () => {
  const say = await user();
  await say("report");
  assert.deepEqual(await say("cancel"), [messages.REPORT_CANCELLED]);
  assert.equal(calls.length, 0);
});

test("the daily limit is explained, and a failure never reads as a result", async () => {
  next = { status: 429, body: {} };
  let say = await user();
  assert.deepEqual((await say("x")).at(-1), messages.DAILY_LIMIT);
  next = { status: 500, body: {} };
  say = await user();
  assert.deepEqual((await say("x")).at(-1), messages.API_ERROR);
});

test("trending isn't a command any more, so no report counts can show", async () => {
  next = { status: 200, body: reply() };
  const say = await user();
  await say("trending");
  assert.ok(calls.every((c) => c.path === "/v1/public/check"));
});

test("the bot's own wording has no banned words, scores or old sources", () => {
  for (const [name, words] of Object.entries(messages)) {
    if (typeof words !== "string") continue;
    assert.doesNotMatch(words, /\b(safe|unsafe|scam|verified|fraudulent|score|risk|coingecko)\b/i, name);
  }
});

test("no code calls the old /api, and nothing logs a message or sender", () => {
  for (const file of ["api.js", "router.js", "flows/checkFlow.js", "flows/reportFlow.js"]) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\/api\//, file);
    assert.doesNotMatch(source, /console\.\w+\([^\n]*(text|phone|jid|sender\b|query)/, file);
  }
});
