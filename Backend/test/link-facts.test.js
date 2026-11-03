import assert from "node:assert/strict";
import net from "node:net";
import { after, before, beforeEach, test } from "node:test";

import { post, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";
import { buildIdentifier, hashIdentifier } from "../src/lib/identifiers.js";
import { DomainAge, Entity, Identifier, Record, Source } from "../src/models/index.js";
import { domainAge, registrableDomain, rdapRegisteredOn, whoisRegisteredOn } from "../src/services/domainAge.js";
import { checkMessage, looksShortened } from "../src/services/messageCheck.js";

// FIXTURE data, with fake pages and lookups. No test reaches the internet.
before(startDb);
after(stopDb);

const DAY = 86_400_000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const noAi = async () => ({ error: "off" });
const page = (extra = {}) => async (url) => ({ error: false, title: "", bodyText: "An offer", finalUrl: url, isHttps: url.startsWith("https"), ...extra });
const ageOf = (days) => ({ domainAge: async () => (days === null ? null : daysAgo(days)) });

beforeEach(async () => {
  await Promise.all([Entity, Identifier, Record, Source, DomainAge].map((m) => m.deleteMany({})));
  const source = await Source.create({ publisher: "Fixture Regulator", type: "notice", title: "F", url: "https://example.test/n", publishedOn: new Date("2026-07-01") });
  const entity = await Entity.create({ name: "Fixture Scheme", slug: "fixture-scheme", kind: "platform" });
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("domain", "listed-scheme.com"), origin: "notice" });
  await Record.create({ entityId: entity._id, sourceId: source._id, type: "warning", quote: "q", capturedBy: "a", reviewedBy: "b", status: "active" });
});

const run = (input, deps) => checkMessage(input, { readPage: noAi, domainAge: async () => null, ...deps });
const facts = async (input, deps) => (await run(input, deps)).result.report.link_facts;

/* --- Where links really land ------------------------------------------- */

test("a short link to a listed site gets the notice", async () => {
  const { result } = await run({ text: "Join at https://bit.ly/abc" }, { scrape: page({ finalUrl: "https://www.listed-scheme.com/join" }) });
  assert.equal(result.state, "named_in_notice");
  assert.equal(result.tier, 1);
  assert.equal(result.entity, "Fixture Scheme");
});

test("the landing domain is logged as a hash, with the rest", async () => {
  const { identifierHashes } = await run({ text: "https://bit.ly/abc" }, { scrape: page({ finalUrl: "https://listed-scheme.com/" }) });
  assert.ok(identifierHashes.includes(hashIdentifier("domain", "listed-scheme.com")));
});

test("a redirect says where it went", async () => {
  const list = await facts({ text: "https://first.com/x" }, { scrape: page({ finalUrl: "https://second.xyz/y" }) });
  assert.ok(list.includes("The link first.com leads to second.xyz."));
});

test("a link that stays on its own site, or just adds www, isn't a redirect", async () => {
  const list = await facts({ text: "https://first.com/x" }, { scrape: page({ finalUrl: "https://www.first.com/y" }) });
  assert.ok(!list.some((f) => /leads to/.test(f)));
});

/* --- Link facts --------------------------------------------------------- */

for (const short of ["bit.ly", "tinyurl.com", "cutt.ly", "rb.gy", "is.gd"]) {
  test(`${short} is named as a shortener`, async () => {
    const list = await facts({ text: `https://${short}/abc` }, { scrape: page() });
    assert.ok(list.includes("The link uses a link shortener, which hides where it goes."));
  });
}

test("a shortener is noted even if the link won't open", async () => {
  const list = await facts({ text: "https://bit.ly/abc" }, { scrape: async () => ({ error: true }) });
  assert.ok(list.some((f) => /shortener/.test(f)));
});

for (const ending of [".tk", ".ml", ".ga", ".cf", ".gq"]) {
  test(`a site ending ${ending} is noted`, async () => {
    const list = await facts({ urls: [`https://offer${ending}`] }, { scrape: page() });
    assert.ok(list.some((f) => f.includes(`ends in ${ending}`)));
  });
}

for (const ending of [".xyz", ".top", ".click", ".link", ".com", ".online"]) {
  test(`a site ending ${ending} isn't held against it`, async () => {
    assert.deepEqual(await facts({ urls: [`https://offer${ending}`] }, { scrape: page() }), []);
  });
}

test("a landing site's ending counts too", async () => {
  const list = await facts({ text: "https://first.com/x" }, { scrape: page({ finalUrl: "https://second.tk/" }) });
  assert.ok(list.some((f) => f.includes("ends in .tk")));
});

test("a page without HTTPS is noted", async () => {
  const list = await facts({ urls: ["http://first.com"] }, { scrape: page() });
  assert.ok(list.includes("The page doesn't use a secure connection (HTTPS)."));
});

test("login and payment forms are noted", async () => {
  const list = await facts({ urls: ["https://first.com"] }, { scrape: page({ hasLoginForm: true, hasPaymentForm: true }) });
  assert.ok(list.includes("The page asks for a password."));
  assert.ok(list.includes("The page has a payment form."));
});

test("an ordinary secure page has no facts", async () => {
  assert.deepEqual(await facts({ urls: ["https://first.com"] }, { scrape: page() }), []);
});

test("a message with no links has no facts", async () => {
  assert.deepEqual(await facts({ text: "Pay 0240000099" }), []);
});

test("link facts change no status or tier", async () => {
  const { result } = await run({ urls: ["http://first.tk"] }, { scrape: page({ hasLoginForm: true, hasPaymentForm: true }), ...ageOf(2) });
  assert.equal(result.state, "no_record");
  assert.equal(result.tier, null);
  assert.deepEqual(result.reason_codes, []);
  assert.equal(result.match, false);
  assert.ok(result.report.link_facts.length >= 4);
});

/* --- Domain age in the reply --------------------------------------------- */

test("a new site says how old it is", async () => {
  const list = await facts({ urls: ["https://first.com"] }, { scrape: page(), ...ageOf(9) });
  assert.ok(list.some((f) => /first\.com was registered 9 days ago/.test(f)), list.join());
});

test("one day reads properly", async () => {
  const list = await facts({ urls: ["https://first.com"] }, { scrape: page(), ...ageOf(1) });
  assert.ok(list.some((f) => /registered 1 day ago/.test(f)));
});

test("an older site gets no age line", async () => {
  assert.deepEqual(await facts({ urls: ["https://first.com"] }, { scrape: page(), ...ageOf(91) }), []);
});

test("an unknown age says nothing", async () => {
  assert.deepEqual(await facts({ urls: ["https://first.com"] }, { scrape: page(), ...ageOf(null) }), []);
});

test("a failed age lookup doesn't fail the check", async () => {
  const boom = async () => {
    throw new Error("down");
  };
  const { result } = await run({ urls: ["https://first.com"] }, { scrape: page(), domainAge: boom });
  assert.equal(result.state, "no_record");
});

test("a direct website lookup gets the age too", async () => {
  const list = await facts({ recipient: "first.com", type: "domain" }, { ...ageOf(3) });
  assert.ok(list.some((f) => /registered 3 days ago/.test(f)));
});

test("the landing site's age is the one that matters", async () => {
  const seen = [];
  await run({ text: "https://bit.ly/abc" }, { scrape: page({ finalUrl: "https://second.com/" }), domainAge: async (d) => (seen.push(d), null) });
  assert.ok(seen.includes("second.com"));
  assert.ok(!seen.includes("bit.ly"));
});

/* --- Registrable domains ------------------------------------------------- */

for (const [input, expected] of [
  ["example.com", "example.com"],
  ["app.example.com", "example.com"],
  ["a.b.example.com", "example.com"],
  ["ghanaweb.com.gh", "ghanaweb.com.gh"],
  ["www.ghanaweb.com.gh", "ghanaweb.com.gh"],
  ["shop.example.org.gh", "example.org.gh"],
  ["nic.gh", "nic.gh"],
  ["example.co.uk", "example.co.uk"],
  ["localhost", null],
  ["", null],
]) {
  test(`registrable domain of "${input}"`, () => assert.equal(registrableDomain(input), expected));
}

/* --- Lookups and cache --------------------------------------------------- */

const lookups = (date, calls = {}) => ({
  rdap: async (d) => ((calls.rdap = (calls.rdap || 0) + 1), (calls.lastRdap = d), date),
  whois: async (d) => ((calls.whois = (calls.whois || 0) + 1), (calls.lastWhois = d), date),
});
const WHEN = new Date("2026-10-01T00:00:00Z");

test("other domains use RDAP, on the registrable domain", async () => {
  const calls = {};
  assert.deepEqual(await domainAge("app.example.com", lookups(WHEN, calls)), WHEN);
  assert.equal(calls.lastRdap, "example.com");
  assert.equal(calls.whois, undefined);
});

test(".gh lookups can be switched off", async () => {
  process.env.GH_WHOIS_LOOKUP = "false";
  const calls = {};
  assert.equal(await domainAge("shop.com.gh", lookups(WHEN, calls)), null);
  assert.equal(calls.whois, undefined);
  assert.equal(calls.rdap, undefined);
});

test(".gh domains use the registry by default", async () => {
  delete process.env.GH_WHOIS_LOOKUP;
  const calls = {};
  assert.deepEqual(await domainAge("shop.com.gh", lookups(WHEN, calls)), WHEN);
  assert.equal(calls.lastWhois, "shop.com.gh");
  process.env.GH_WHOIS_LOOKUP = "false";
});

test("a date is cached, as a hash with no domain name", async () => {
  const calls = {};
  await domainAge("cached.com", lookups(WHEN, calls));
  await domainAge("cached.com", lookups(WHEN, calls));
  assert.equal(calls.rdap, 1);
  const row = await DomainAge.collection.findOne({});
  assert.ok(!JSON.stringify(row).includes("cached.com"));
  assert.match(row.valueHash, /^[a-f0-9]{64}$/);
  assert.ok(row.expiresAt > new Date());
  const indexes = await DomainAge.collection.indexes();
  assert.equal(indexes.find((i) => i.key.expiresAt)?.expireAfterSeconds, 0);
});

test("an unknown date is cached too, so nobody is asked repeatedly", async () => {
  const calls = {};
  assert.equal(await domainAge("unknown.com", lookups(null, calls)), null);
  await domainAge("unknown.com", lookups(null, calls));
  assert.equal(calls.rdap, 1);
});

test("a failed lookup isn't cached, and returns nothing", async () => {
  const boom = { rdap: async () => { throw new Error("down"); } };
  assert.equal(await domainAge("flaky.com", boom), null);
  assert.equal(await DomainAge.countDocuments(), 0);
});

test("a nonsense or future date is ignored", async () => {
  assert.equal(await domainAge("future.com", lookups(new Date(Date.now() + 10 * DAY))), null);
  assert.equal(await domainAge("invalid.com", lookups(new Date("nope"))), null);
});

test("the .gh lookups stop at the hourly cap", async () => {
  process.env.GH_WHOIS_LOOKUP = "true";
  process.env.GH_WHOIS_MAX_PER_HOUR = "2";
  const calls = {};
  for (const d of ["a1.com.gh", "a2.com.gh", "a3.com.gh", "a4.com.gh"]) await domainAge(d, lookups(WHEN, calls));
  assert.ok(calls.whois <= 2, String(calls.whois));
  process.env.GH_WHOIS_LOOKUP = "false";
  delete process.env.GH_WHOIS_MAX_PER_HOUR;
});

/* --- Reading what comes back ---------------------------------------------- */

test("RDAP: reads the registration date", async () => {
  const fetchJson = async () => ({ events: [{ eventAction: "last changed", eventDate: "2026-01-01T00:00:00Z" }, { eventAction: "registration", eventDate: "1995-08-14T04:00:00Z" }] });
  assert.deepEqual(await rdapRegisteredOn("example.com", { fetchJson }), new Date("1995-08-14T04:00:00Z"));
});

test("RDAP: no date is no answer", async () => {
  assert.equal(await rdapRegisteredOn("example.com", { fetchJson: async () => ({ events: [] }) }), null);
});

function fakeWhois(reply) {
  const seen = [];
  const server = net.createServer((socket) => {
    socket.on("data", (d) => {
      seen.push(d.toString());
      socket.end(reply);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, seen, port: server.address().port })));
}

const WHOIS_RECORD = `Domain Name: shop.com.gh
Creation Date: 2026-10-20T00:00:00.0Z
Registrant Name: A PERSON
Registrant Email: person@example.test
Registrant Phone: +233240000000
`;

test("whois: reads only the creation date", async () => {
  const { server, seen, port } = await fakeWhois(WHOIS_RECORD);
  const date = await whoisRegisteredOn("shop.com.gh", { host: "127.0.0.1", port });
  server.close();
  assert.deepEqual(date, new Date("2026-10-20T00:00:00.0Z"));
  assert.equal(seen[0], "shop.com.gh\r\n");
  assert.ok(date instanceof Date);
});

test("whois: no record is no answer", async () => {
  const { server, port } = await fakeWhois("Domain Name: x.com.gh\nNo match\n");
  assert.equal(await whoisRegisteredOn("x.com.gh", { host: "127.0.0.1", port }), null);
  server.close();
});

for (const bad of ["evil.com", "a.gh\r\nother.gh", "a b.gh", "../.gh"]) {
  test(`whois refuses ${JSON.stringify(bad)}`, async () => {
    assert.equal(await whoisRegisteredOn(bad, { host: "127.0.0.1", port: 1 }), null);
  });
}

test("whois: a silent server times out", async () => {
  const server = net.createServer(() => {});
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const started = Date.now();
  assert.equal(await whoisRegisteredOn("x.com.gh", { host: "127.0.0.1", port: server.address().port, timeoutMs: 150 }), null);
  assert.ok(Date.now() - started < 2000);
  server.close(() => {});
  server.closeAllConnections?.();
});

/* --- Privacy ------------------------------------------------------------- */

test("the reply and database hold nothing from the whois record", async () => {
  const api = await serve(createApp());
  const res = await post(`${api.url}/v1/public/check`, { text: "Hello" }, { "x-forwarded-for": "198.18.9.9" });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).report.link_facts, []);
  await api.close();
});

/* --- Shorteners nobody has listed yet ------------------------------------ *
 *
 * SHORTENERS holds the ten everyone knows. A campaign only has to register an
 * eleventh to walk past it, and the traffic-fine run used d1.mk, which is on
 * no list. The shape is what it cannot hide.
 */

test("a link shaped like a shortener is recognised without being on the list", () => {
  for (const link of ["https://d1.mk/v7UNjTl", "https://x9.co/aB3dEfG", "https://t.ly/Kd93ms"]) {
    assert.equal(looksShortened(link), true, `should look shortened: ${link}`);
  }
});

test("ordinary links are not called shorteners", () => {
  for (const link of [
    "https://sec.gov.gh/notices/2025",
    "https://dvla.gov.gh/fines",
    "https://mybank.com/login",
    "https://news.com/article-about-traffic",
    "https://shop.gh/p?id=99",
    "https://bit.ly/abc123",
  ]) {
    assert.equal(looksShortened(link), false, `should not look shortened: ${link}`);
  }
});
