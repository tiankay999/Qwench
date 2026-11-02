import assert from "node:assert/strict";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";

import { startDb, stopDb } from "./helpers/setup.js";
import { pageSignals } from "../src/engine/pageSignals.js";
import { PageSeen } from "../src/models/index.js";
import { frozenFor } from "../src/services/pageSeen.js";
import { checkMessage } from "../src/services/messageCheck.js";
import { scrapeUrl } from "../src/services/urlAnalyzer.js";

// FIXTURE pages only. Nothing here reaches the internet.
before(startDb);
after(stopDb);
beforeEach(() => PageSeen.deleteMany({}));

const html = (body, scripts = "") => `<html><head>${scripts}</head><body>${body}</body></html>`;
const signals = (body, scripts, host = "offer.com") => pageSignals(html(body, scripts), host);
const repeat = (n, make) => Array.from({ length: n }, (_, i) => make(i)).join("");

/* --- Links and buttons that go nowhere --------------------------------- */

const DEAD = repeat(6, (i) => `<a href="#">Link ${i}</a>`);

test("a static page full of dead links is flagged", () => {
  assert.equal(signals(DEAD).deadControls, true);
});

for (const [label, body] of [
  ["empty links", repeat(6, () => '<a href="">x</a>')],
  ["javascript links", repeat(6, () => '<a href="javascript:void(0)">x</a>')],
  ["anchors with no href", repeat(6, () => "<a>x</a>")],
  ["buttons outside any form", repeat(6, () => "<button>Claim</button>")],
]) {
  test(`dead controls include ${label}`, () => assert.equal(signals(body).deadControls, true));
}

test("a page with scripts isn't called dead, because they may run the links", () => {
  assert.equal(signals(DEAD, '<script src="/app.js"></script><script src="/two.js"></script>').deadControls, false);
});

test("one analytics script doesn't excuse it", () => {
  assert.equal(signals(DEAD, '<script src="/analytics.js"></script>').deadControls, true);
});

test("a few dead links aren't flagged", () => {
  assert.equal(signals(repeat(4, () => '<a href="#">x</a>')).deadControls, false);
});

test("a page where most links work isn't flagged", () => {
  assert.equal(signals(DEAD + repeat(10, (i) => `<a href="/p${i}">x</a>`)).deadControls, false);
});

test("a form that sends nowhere is a dead control", () => {
  assert.equal(signals(DEAD.slice(0, 40) + repeat(5, () => '<form action="#"><button>Go</button></form>')).deadControls, true);
});

test("a form that really submits isn't", () => {
  assert.equal(signals(repeat(6, () => '<form action="/join"><button>Go</button></form>')).deadControls, false);
});

/* --- Links that aren't what they show ----------------------------------- */

test("a link showing one address and going to another is flagged", () => {
  assert.equal(signals('<a href="https://evil-site.com/x">www.mybank.com</a>').mismatchedLink, true);
});

for (const body of [
  '<a href="https://www.mybank.com/x">mybank.com</a>',
  '<a href="https://app.mybank.com/login">www.mybank.com</a>',
  '<a href="https://mybank.com">Open my bank</a>',
  '<a href="/local">www.mybank.com is great</a>',
  '<a href="https://first.com/a.b">Read more.Here</a>',
]) {
  test(`not a mismatch: ${body}`, () => assert.equal(signals(body).mismatchedLink, false));
}

for (const body of ['<a href="http://192.168.4.5/pay">Pay</a>', '<a href="http://8.8.8.8/pay">Pay</a>', '<a href="https://xn--pple-43d.com/">Apple</a>']) {
  test(`an odd address is flagged: ${body}`, () => assert.equal(signals(body).oddLink, true));
}

test("an ordinary link isn't odd", () => {
  assert.equal(signals('<a href="https://ghanaweb.com/news">News</a>').oddLink, false);
});

test("most links going to a chat app is flagged", () => {
  assert.equal(signals(repeat(4, () => '<a href="https://wa.me/233240000000">Join</a>') + '<a href="/about">About</a>').chatLinks, true);
  assert.equal(signals(repeat(3, () => '<a href="https://t.me/group">Join</a>')).chatLinks, true);
});

test("one chat link among many isn't", () => {
  assert.equal(signals('<a href="https://wa.me/233240000000">Chat</a>' + repeat(10, (i) => `<a href="/p${i}">x</a>`)).chatLinks, false);
});

/* --- Comments that all show one time ----------------------------------- */

const comment = (name, when) => `<div class="c"><b>${name}</b><span>${when}</span><p>I got my bonus!</p></div>`;

test("comments all showing the same time are flagged", () => {
  assert.equal(signals(repeat(5, (i) => comment(`User ${i}`, "2 minutes ago"))).sameTimes, true);
});

test("most comments showing the same time are flagged", () => {
  const body = repeat(4, (i) => comment(`U${i}`, "just now")) + comment("V", "3 hours ago");
  assert.equal(signals(body).sameTimes, true);
});

test("clock times count too", () => {
  assert.equal(signals(repeat(4, (i) => comment(`U${i}`, "12:30 PM"))).sameTimes, true);
});

test("ordinary, varied times aren't flagged", () => {
  const times = ["2 minutes ago", "1 hour ago", "3 days ago", "5 hours ago", "1 day ago"];
  assert.equal(signals(times.map((t, i) => comment(`U${i}`, t)).join("")).sameTimes, false);
});

test("two matching times aren't enough", () => {
  assert.equal(signals(repeat(2, (i) => comment(`U${i}`, "2 minutes ago"))).sameTimes, false);
});

test("a page's relative times make a signature, and other pages differ", () => {
  const a = signals(comment("A", "2 minutes ago") + comment("B", "5 minutes ago"));
  const b = signals(comment("A", "3 minutes ago") + comment("B", "6 minutes ago"));
  assert.ok(a.timeSignature);
  assert.notEqual(a.timeSignature, b.timeSignature);
  assert.equal(signals("<p>No times</p>").timeSignature, null);
  assert.equal(signals(comment("A", "12:30 PM")).timeSignature, null);
});

test("hidden text and scripts are ignored, and bad input is harmless", () => {
  assert.equal(pageSignals("", "x.com").deadControls, false);
  assert.equal(pageSignals(null, "x.com").sameTimes, false);
});

/* --- Times that never move --------------------------------------------- */

const HOUR = 3_600_000;

test("the first visit says nothing, and stores no address or text", async () => {
  assert.equal(await frozenFor("https://offer.com/page", "abc", new Date()), null);
  const row = await PageSeen.collection.findOne({});
  assert.ok(!JSON.stringify(row).includes("offer.com"));
  assert.ok(row.expiresAt > new Date());
});

test("the same relative times hours later are frozen", async () => {
  const start = new Date("2026-11-01T00:00:00Z");
  await frozenFor("https://offer.com/page", "abc", start);
  assert.equal(await frozenFor("https://offer.com/page", "abc", new Date(start.getTime() + 5 * HOUR)), 5);
});

test("too soon proves nothing", async () => {
  const start = new Date("2026-11-01T00:00:00Z");
  await frozenFor("https://offer.com/page", "abc", start);
  assert.equal(await frozenFor("https://offer.com/page", "abc", new Date(start.getTime() + 59 * 60_000)), null);
});

test("times that moved aren't frozen, and restart the clock", async () => {
  const start = new Date("2026-11-01T00:00:00Z");
  await frozenFor("https://offer.com/page", "abc", start);
  assert.equal(await frozenFor("https://offer.com/page", "xyz", new Date(start.getTime() + 5 * HOUR)), null);
  assert.equal(await frozenFor("https://offer.com/page", "xyz", new Date(start.getTime() + 5.5 * HOUR)), null);
  assert.equal(await frozenFor("https://offer.com/page", "xyz", new Date(start.getTime() + 8 * HOUR)), 3);
});

test("no signature does nothing", async () => {
  assert.equal(await frozenFor("https://offer.com/page", null, new Date()), null);
  assert.equal(await PageSeen.countDocuments(), 0);
});

/* --- In the reply -------------------------------------------------------- */

const page = (extra) => async (url) => ({ error: false, title: "", bodyText: "Offer", finalUrl: url, isHttps: true, ...extra });
const run = (scrape, extra = {}) => checkMessage({ urls: ["https://offer.com"] }, { scrape, readPage: async () => ({}), domainAge: async () => null, ...extra });

for (const [signal, wording] of [
  ["deadControls", /links and buttons don't go anywhere/],
  ["mismatchedLink", /shows one address but goes to another/],
  ["oddLink", /unusual address/],
  ["chatLinks", /Most of the page's links go to a chat app/],
  ["sameTimes", /comments all show the same time/],
]) {
  test(`${signal} reaches the reply, and changes no status`, async () => {
    const { result } = await run(page({ pageSignals: { [signal]: true } }));
    assert.ok(result.report.link_facts.some((f) => wording.test(f)), result.report.link_facts.join());
    assert.equal(result.state, "no_record");
    assert.equal(result.tier, null);
  });
}

test("frozen times reach the reply, with how long", async () => {
  const start = new Date(Date.now() - 7 * HOUR);
  await frozenFor("https://offer.com", "sig", start);
  const { result } = await run(page({ pageSignals: { timeSignature: "sig" } }));
  assert.ok(result.report.link_facts.some((f) => /still show the same times as 7 hours ago/.test(f)), result.report.link_facts.join());
});

test("the signals count toward the evidence level", async () => {
  const { result } = await run(page({ pageSignals: { deadControls: true, chatLinks: true, sameTimes: true } }));
  assert.equal(result.report.evidence_level.code, "many_signs");
});

test("a failed comparison doesn't fail the check", async () => {
  const { result } = await run(page({ pageSignals: { timeSignature: "sig" } }), { pageFrozen: async () => { throw new Error("down"); } });
  assert.equal(result.state, "no_record");
});

test("the fake-bonus page, end to end, through the real scraper", async () => {
  const body = `<h1>Claim your bonus!</h1><p>Free gift for every member</p>${repeat(6, (i) => `<a href="#">Menu ${i}</a>`)}
    <a href="https://evil-site.com/x">www.mybank.com</a>${repeat(5, (i) => comment(`Happy ${i}`, "2 minutes ago"))}`;
  const server = http.createServer((_q, r) => { r.writeHead(200, { "content-type": "text/html" }); r.end(html(body)); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const content = await scrapeUrl(`http://page.test:${port}/`, { resolve: async () => ["127.0.0.1"], isAllowedAddress: () => true, allowedPorts: [port] });
  server.close();

  assert.equal(content.pageSignals.deadControls, true);
  assert.equal(content.pageSignals.mismatchedLink, true);
  assert.equal(content.pageSignals.sameTimes, true);
  const { result } = await run(async () => ({ ...content, finalUrl: "https://offer.com", isHttps: true }));
  assert.ok(result.report.warning_signs.includes("The message offers bonuses or free gifts."));
  assert.equal(result.report.evidence_level.code, "many_signs");
});
