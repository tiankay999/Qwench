import assert from "node:assert/strict";
import { test } from "node:test";

import { handleMessage, qwenchClient } from "../src/bot.js";
import { API_DOWN, DAILY_LIMIT, HELP, REPORT_USAGE, WELCOME, formatReply, splitMessage } from "../src/format.js";

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
const reply = (extra = {}) => ({ state: "named_in_notice", report: REPORT, is_demo: false, ...extra });
const message = (extra) => ({ chat: { id: 5 }, from: { id: 77 }, ...extra });

function fakeQwench(response = { status: 200, body: reply() }) {
  const calls = [];
  return {
    calls,
    check: async (input, sender) => (calls.push({ kind: "check", input, sender }), response),
    report: async (name, sender) => (calls.push({ kind: "report", name, sender }), response),
  };
}

test("the reply leads with the evidence level, and keeps the API's order", () => {
  const text = formatReply(reply());
  assert.ok(text.startsWith("Regulator warning"));
  const order = ["Regulator warning", "named Fixture Scheme", "Sources", "Also checked", "Stated return", "Warning signs", "Spotted by AI", "About the link", "Questions to ask", "Read from an image", "not a final ruling", "Information, not advice"];
  let last = -1;
  for (const part of order) {
    const at = text.indexOf(part);
    assert.ok(at > last, part);
    last = at;
  }
});

test("AI-spotted signs are labelled", () => {
  assert.match(formatReply(reply()), /Spotted by AI\n- The image seems/);
});

test("demo data says so first", () => {
  assert.ok(formatReply(reply({ is_demo: true })).startsWith("DEMO DATA"));
});

test("a close name is offered, never shown as a match", () => {
  assert.match(formatReply(reply({ did_you_mean: { suggested_entity: "Fixture Scheme" } })), /Did you mean Fixture Scheme\? Send that name/);
});

test("empty sections are left out", () => {
  const text = formatReply(reply({ report: { ...REPORT, sources: [], also_checked: [], return_check: null, warning_signs: [], ai_warning_signs: [], link_facts: [], questions_to_ask: [], notes: [] } }));
  for (const heading of ["Sources", "Also checked", "Stated return", "Warning signs", "Spotted by AI", "About the link", "Questions"]) assert.ok(!text.includes(heading), heading);
});

test("the bot's own wording has no banned words or verdicts", () => {
  for (const words of [WELCOME, HELP, REPORT_USAGE, API_DOWN, DAILY_LIMIT]) {
    assert.doesNotMatch(words, /\b(safe|unsafe|scam|verified|fraudulent|score|risk)\b/i);
  }
});

test("long replies are split below Telegram's limit, without losing anything", () => {
  const text = Array.from({ length: 30 }, (_, i) => `Paragraph ${i} ${"x".repeat(300)}`).join("\n\n");
  const chunks = splitMessage(text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 4000));
  assert.equal(chunks.join("\n\n"), text);
});

test("a message goes to the API as the sender's reference", async () => {
  const qwench = fakeQwench();
  const [text] = await handleMessage(message({ text: "Is this real? Pay 0240000000" }), { qwench });
  assert.deepEqual(qwench.calls[0], { kind: "check", input: { text: "Is this real? Pay 0240000000" }, sender: "telegram:77" });
  assert.match(text, /Regulator warning/);
});

test("a screenshot goes as an image, with its caption", async () => {
  const qwench = fakeQwench();
  await handleMessage(message({ caption: "Got this", photo: [{ file_id: "small" }, { file_id: "large" }] }), { qwench, downloadPhoto: async (id) => ({ base64: `b64-${id}`, mimeType: "image/jpeg" }) });
  assert.deepEqual(qwench.calls[0].input, { text: "Got this", image_base64: "b64-large", mime_type: "image/jpeg" });
});

test("a photo that won't download gets the welcome, not a false result", async () => {
  const qwench = fakeQwench();
  const replies = await handleMessage(message({ photo: [{ file_id: "x" }] }), { qwench, downloadPhoto: async () => { throw new Error("down"); } });
  assert.deepEqual(replies, [WELCOME]);
  assert.equal(qwench.calls.length, 0);
});

for (const [command, expected] of [["/start", WELCOME], ["/help", HELP], ["/help@QwenchBot", HELP], ["/report", REPORT_USAGE], ["/report   ", REPORT_USAGE]]) {
  test(`${command} needs no API call`, async () => {
    const qwench = fakeQwench();
    assert.deepEqual(await handleMessage(message({ text: command }), { qwench }), [expected]);
    assert.equal(qwench.calls.length, 0);
  });
}

test("/report sends the name, and shows the API's thanks", async () => {
  const qwench = fakeQwench({ status: 202, body: { message: "Thank you. A person will review this." } });
  assert.deepEqual(await handleMessage(message({ text: "/report Fixture Scheme" }), { qwench }), ["Thank you. A person will review this."]);
  assert.deepEqual(qwench.calls[0], { kind: "report", name: "Fixture Scheme", sender: "telegram:77" });
});

test("the daily limit is explained", async () => {
  assert.deepEqual(await handleMessage(message({ text: "hi" }), { qwench: fakeQwench({ status: 429, body: {} }) }), [DAILY_LIMIT]);
});

test("an API failure never reads as a result", async () => {
  assert.deepEqual(await handleMessage(message({ text: "hi" }), { qwench: fakeQwench({ status: 500, body: {} }) }), [API_DOWN]);
});

test("an unknown command isn't sent as an offer to check", async () => {
  const qwench = fakeQwench();
  assert.deepEqual(await handleMessage(message({ text: "/whatever" }), { qwench }), [WELCOME]);
  assert.equal(qwench.calls.length, 0);
});

test("the client sends the channel and key the API expects", async () => {
  const seen = {};
  const client = qwenchClient({ baseUrl: "http://api.test", channelKey: "k", fetch: async (url, init) => { Object.assign(seen, { url, ...init }); return { status: 200, json: async () => ({}) }; } });
  await client.check({ text: "x" }, "telegram:1");
  assert.equal(seen.url, "http://api.test/v1/public/check");
  assert.equal(seen.headers["x-channel-key"], "k");
  assert.deepEqual(JSON.parse(seen.body), { text: "x", channel: "telegram", sender_ref: "telegram:1" });
});
