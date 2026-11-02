import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

import { startDb, stopDb } from "./helpers/setup.js";
import { buildIdentifier } from "../src/lib/identifiers.js";
import { Entity, Identifier, Record, Source } from "../src/models/index.js";
import { checkMessage } from "../src/services/messageCheck.js";

// FIXTURE data, with fake page and AI readers, so no network or provider is used.
let source;

before(startDb);
after(stopDb);

beforeEach(async () => {
  await Promise.all([Entity, Identifier, Record, Source].map((m) => m.deleteMany({})));
  source = await Source.create({ publisher: "Fixture Regulator", type: "notice", title: "Fixture", url: "https://example.test/n", publishedOn: new Date("2026-07-01") });
  const entity = await Entity.create({ name: "Fixture Scheme", slug: "fixture-scheme", kind: "platform" });
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("name", "Fixture Scheme"), origin: "notice" });
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("momo_number", "+233240000080"), origin: "notice" });
  await Record.create({ entityId: entity._id, sourceId: source._id, type: "warning", quote: "Fixture", capturedBy: "a", reviewedBy: "b", status: "active" });
});

const page = (bodyText) => async () => ({ error: false, title: "A page", metaDescription: "", bodyText });
const noAi = async () => ({ error: "off" });

test("a number on a linked page is checked", async () => {
  const { result } = await checkMessage({ urls: ["https://page.test"] }, { scrape: page("Pay 0240000080 today"), readPage: noAi });
  assert.equal(result.state, "named_in_notice");
});

test("a name on a linked page is checked", async () => {
  const { result } = await checkMessage({ urls: ["https://page.test"] }, { scrape: page("Welcome to Fixture Scheme"), readPage: noAi });
  assert.equal(result.state, "named_in_notice");
});

test("returns stated on a linked page are restated", async () => {
  const { result } = await checkMessage({ urls: ["https://page.test"] }, { scrape: page("Earn 10% a week, guaranteed"), readPage: noAi });
  assert.equal(result.report.return_check.annual_percent, 520);
  assert.ok(result.report.warning_signs.length);
});

test("links on a linked page aren't followed", async () => {
  const seen = [];
  const scrape = async (url) => {
    seen.push(url);
    return { error: false, title: "", metaDescription: "", bodyText: "see https://second.test/page" };
  };
  await checkMessage({ urls: ["https://first.test"] }, { scrape, readPage: noAi });
  assert.deepEqual(seen, ["https://first.test"]);
});

test("at most three links are fetched", async () => {
  let count = 0;
  const scrape = async () => {
    count += 1;
    return { error: false, title: "", metaDescription: "", bodyText: "" };
  };
  await checkMessage({ text: "a.com b.com c.com d.com e.com" }, { scrape, readPage: noAi });
  assert.equal(count, 3);
});

test("a page that fails to open doesn't fail the check", async () => {
  const { result } = await checkMessage({ text: "Fixture Scheme https://down.test" }, { scrape: async () => ({ error: true }), readPage: noAi });
  assert.equal(result.state, "named_in_notice");
  assert.ok(result.report.notes.some((n) => /could not be opened/.test(n)));
});

test("an AI name that isn't in the image is ignored", async () => {
  const readImage = async () => ({ extracted_text: "Join Real Group now", entities_mentioned: ["Fixture Scheme"], numbers_found: [], domains_found: [], wallets_found: [] });
  const { result } = await checkMessage({ image_base64: "eA==", mime_type: "image/png" }, { readImage });
  assert.equal(result.state, "no_record");
});

test("an AI name that is in the image is checked", async () => {
  const readImage = async () => ({ extracted_text: "Join Fixture Scheme now", entities_mentioned: ["Fixture Scheme"], numbers_found: [], domains_found: [], wallets_found: [] });
  const { result } = await checkMessage({ image_base64: "eA==", mime_type: "image/png" }, { readImage });
  assert.equal(result.state, "named_in_notice");
  assert.deepEqual(result.report.notes, []);
});

test("a number read from an image is checked", async () => {
  const readImage = async () => ({ extracted_text: "Pay 024 000 0080", entities_mentioned: [], numbers_found: ["024 000 0080"], domains_found: [], wallets_found: [] });
  const { result } = await checkMessage({ image_base64: "eA==", mime_type: "image/png" }, { readImage });
  assert.equal(result.state, "named_in_notice");
});

test("AI can't change a status, tier or wording", async () => {
  const readImage = async () => ({ extracted_text: "Hello", state: "licensed", tier: 1, verdict: "bad", entities_mentioned: [], numbers_found: [], domains_found: [], wallets_found: [] });
  const { result } = await checkMessage({ image_base64: "eA==", mime_type: "image/png" }, { readImage });
  assert.equal(result.state, "no_record");
  assert.equal(result.tier, null);
  assert.ok(!JSON.stringify(result).includes("bad"));
});

test("an AI provider that throws doesn't fail the check", async () => {
  const boom = async () => {
    throw new Error("provider down");
  };
  const image = await checkMessage({ text: "Fixture Scheme", image_base64: "eA==", mime_type: "image/png" }, { readImage: boom });
  assert.equal(image.result.state, "named_in_notice");
  assert.ok(image.result.report.notes.some((n) => /image could not be read/.test(n)));

  const link = await checkMessage({ text: "Fixture Scheme https://page.test" }, { scrape: page("x"), readPage: boom });
  assert.equal(link.result.state, "named_in_notice");
});

test("the lookups are logged as hashes", async () => {
  const { identifierHashes, inputType } = await checkMessage({ text: "Pay 0240000080 at fixture.com" }, { scrape: page(""), readPage: noAi });
  assert.equal(identifierHashes.length, 2);
  for (const hash of identifierHashes) assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(inputType, "number");
});
