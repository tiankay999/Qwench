import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { after, before, beforeEach, test } from "node:test";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { post, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";
import { buildIdentifier, hashIdentifier } from "../src/lib/identifiers.js";
import {
  ApiKey,
  AuditLog,
  Contribution,
  Entity,
  Identifier,
  Organization,
  PublicReport,
  Record,
  Relation,
  Signal,
  Source,
  User,
} from "../src/models/index.js";

// All FIXTURE data, and fixture users with test-only passwords.
const PASSWORD = "fixture-password-1";
let api;
let hash;
let source;
let orgs;
let ip = 0;
const lines = [];

const J = (res) => res.json();
const addr = () => {
  ip += 1;
  return { "x-forwarded-for": `198.18.${Math.floor(ip / 250)}.${ip % 250}` };
};

async function login(email, password = PASSWORD) {
  const res = await post(`${api.url}/v1/console/login`, { email, password }, addr());
  const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
  return { res, cookie };
}

const session = async (email) => (await login(email)).cookie;
const get = (path, cookie) => fetch(`${api.url}/v1/console${path}`, { headers: { cookie, ...addr() } });
const send = (path, body, cookie) => post(`${api.url}/v1/console${path}`, body, { cookie, ...addr() });
const del = (path, cookie) => fetch(`${api.url}/v1/console${path}`, { method: "DELETE", headers: { cookie, ...addr() } });

const user = (email, orgId, role, extra = {}) => User.create({ email, orgId, role, passwordHash: hash, ...extra });

async function fixtureEntity(name, domain) {
  const entity = await Entity.create({ name, slug: name.toLowerCase().replace(/\W+/g, "-"), kind: "platform" });
  if (domain) await Identifier.create({ entityId: entity._id, ...buildIdentifier("domain", domain), origin: "notice" });
  return entity;
}

before(async () => {
  await startDb();
  api = await serve(createApp());
  hash = await bcrypt.hash(PASSWORD, 4);
});

after(async () => {
  await api.close();
  await stopDb();
});

beforeEach(async () => {
  await Promise.all([Entity, Identifier, Record, Source, Relation, Contribution, PublicReport, Signal, User, ApiKey, Organization].map((m) => m.deleteMany({})));
  source = await Source.create({ publisher: "Fixture Regulator", type: "notice", title: "Fixture notice", url: "https://example.test/n", publishedOn: new Date("2026-07-01") });
  orgs = {
    bank: await Organization.create({ name: "Fixture Bank", type: "bank", confirmationCallLimitGhs: 500 }),
    other: await Organization.create({ name: "Other Bank", type: "bank" }),
    qwench: await Organization.create({ name: "Qwench", type: "qwench" }),
  };
  await user("analyst@bank.test", orgs.bank._id, "analyst");
  await user("admin@bank.test", orgs.bank._id, "org_admin");
  await user("admin@other.test", orgs.other._id, "org_admin");
  await user("regulator@bank.test", orgs.other._id, "regulator");
  await user("bankreviewer@bank.test", orgs.bank._id, "reviewer");
  await user("reviewer@qwench.test", orgs.qwench._id, "reviewer");
  await user("second@qwench.test", orgs.qwench._id, "reviewer");
});

/* --- Login ------------------------------------------------------------ */

test("login sets an httpOnly session cookie, with no token in the body", async () => {
  const { res, cookie } = await login("analyst@bank.test");
  assert.equal(res.status, 200);
  const header = res.headers.get("set-cookie");
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Lax/i);
  assert.match(header, /Path=\/v1\/console/i);
  const body = await J(res);
  assert.deepEqual(body.user, { email: "analyst@bank.test", role: "analyst", organization: "Fixture Bank", is_demo: false });
  assert.ok(!JSON.stringify(body).includes(cookie.split("=")[1]));
  assert.ok(!JSON.stringify(body).includes("passwordHash"));
});

test("a wrong password and an unknown email get the same reply", async () => {
  const wrong = await login("analyst@bank.test", "nope");
  const unknown = await login("nobody@bank.test", "nope");
  assert.equal(wrong.res.status, 401);
  assert.equal(unknown.res.status, 401);
  assert.deepEqual(await J(wrong.res), await J(unknown.res));
  assert.equal(wrong.cookie, "");
});

test("email case doesn't matter", async () => {
  assert.equal((await login("ANALYST@bank.test")).res.status, 200);
});

test("a deactivated user can't log in, and an old session stops working", async () => {
  const cookie = await session("analyst@bank.test");
  assert.equal((await get("/me", cookie)).status, 200);
  await User.updateOne({ email: "analyst@bank.test" }, { isActive: false });
  assert.equal((await get("/me", cookie)).status, 401);
  assert.equal((await login("analyst@bank.test")).res.status, 401);
});

test("repeated failed logins are limited", async () => {
  const headers = { "x-forwarded-for": "203.0.113.200" };
  let last;
  for (let i = 0; i < 11; i += 1) last = await post(`${api.url}/v1/console/login`, { email: "analyst@bank.test", password: "nope" }, headers);
  assert.equal(last.status, 429);
});

test("there is no sign-up route", async () => {
  assert.equal((await post(`${api.url}/v1/console/signup`, {}, addr())).status, 404);
  assert.equal((await post(`${api.url}/v1/console/users`, {}, addr())).status, 404);
});

test("me needs a session, and rejects forged and wrong-algorithm tokens", async () => {
  assert.equal((await get("/me", "")).status, 401);
  assert.equal((await get("/me", "qwench_session=garbage")).status, 401);
  const u = await User.findOne({ email: "analyst@bank.test" });
  const forged = jwt.sign({ sub: String(u._id) }, "a-different-secret-value");
  assert.equal((await get("/me", `qwench_session=${forged}`)).status, 401);
  const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: String(u._id) })).toString("base64url")}.`;
  assert.equal((await get("/me", `qwench_session=${none}`)).status, 401);
  const expired = jwt.sign({ sub: String(u._id) }, process.env.JWT_SECRET, { expiresIn: -10 });
  assert.equal((await get("/me", `qwench_session=${expired}`)).status, 401);
});

test("logout clears the cookie", async () => {
  const cookie = await session("analyst@bank.test");
  const res = await send("/logout", {}, cookie);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("set-cookie"), /qwench_session=;/);
});

test("an API key doesn't open the console, and a session doesn't open the API", async () => {
  const cookie = await session("analyst@bank.test");
  assert.equal((await post(`${api.url}/v1/check`, { recipient: "x", type: "name" }, { cookie })).status, 401);
  assert.equal((await post(`${api.url}/v1/console/lookup`, { recipient: "x", type: "name" }, { "x-api-key": "qw_test_x", ...addr() })).status, 401);
});

/* --- Lookup and payment check ------------------------------------------ */

async function noticeScheme() {
  const entity = await fixtureEntity("Fixture Scheme", "fixture-scheme.test");
  await Record.create({ entityId: entity._id, sourceId: source._id, type: "warning", quote: "Fixture", capturedBy: "a", reviewedBy: "b", status: "active" });
  return entity;
}

test("lookup shows state, tier, reason, sources and allowed use", async () => {
  await noticeScheme();
  const body = await J(await send("/lookup", { recipient: "fixture-scheme.test", type: "domain" }, await session("analyst@bank.test")));
  assert.equal(body.state, "named_in_notice");
  assert.equal(body.tier, 1);
  assert.deepEqual(body.reason_codes, ["REGULATOR_NOTICE"]);
  assert.equal(body.sources[0].publisher, "Fixture Regulator");
  assert.equal(body.allowed_use, "customer_warning");
  assert.equal(body.member_report_count, 0);
  assert.equal(body.signal, null);
});

test("lookup counts independent members, and never names them", async () => {
  const valueHash = hashIdentifier("momo_number", "+233240000000");
  const ids = [{ type: "momo_number", valueHash }];
  await Contribution.create({ orgId: orgs.bank._id, schemeName: "Hidden", identifiers: ids, reviewStatus: "reviewed" });
  await Contribution.create({ orgId: orgs.bank._id, schemeName: "Hidden", identifiers: ids, reviewStatus: "reviewed" });
  await Contribution.create({ orgId: orgs.other._id, schemeName: "Hidden", identifiers: ids, reviewStatus: "reviewed" });
  await Contribution.create({ orgId: orgs.other._id, schemeName: "Hidden", identifiers: ids, reviewStatus: "pending" });
  const res = await send("/lookup", { recipient: "0240000000", type: "momo_number" }, await session("analyst@bank.test"));
  const text = await res.text();
  const body = JSON.parse(text);
  assert.equal(body.member_report_count, 2);
  assert.equal(body.tier, 2);
  for (const secret of ["Fixture Bank", "Other Bank", String(orgs.bank._id), String(orgs.other._id)]) assert.ok(!text.includes(secret), secret);
});

test("payment check matches /v1/check, using the user's organisation", async () => {
  await noticeScheme();
  const body = { recipient: "fixture-scheme.test", type: "domain", amount_ghs: 800, new_payee: true };
  const consoleReply = await J(await send("/payment-check", body, await session("analyst@bank.test")));
  assert.equal(consoleReply.suggested_action, "warn_or_confirmation_call");

  const { generateApiKey } = await import("../src/models/index.js");
  const k = generateApiKey({ live: false });
  await ApiKey.create({ orgId: orgs.bank._id, keyHash: k.keyHash, prefix: k.prefix, scopes: ["check"] });
  const apiReply = await J(await post(`${api.url}/v1/check`, body, { "x-api-key": k.rawKey }));
  const strip = ({ checked_at: _a, ...rest }) => rest;
  assert.deepEqual(strip(consoleReply), strip(apiReply));
});

test("an unknown recipient gets match false and no action", async () => {
  const body = await J(await send("/payment-check", { recipient: "0240000009", type: "momo_number" }, await session("analyst@bank.test")));
  assert.equal(body.match, false);
  assert.equal(body.state, "no_record");
  assert.equal(body.suggested_action, "none");
});

test("lookup needs valid input", async () => {
  assert.equal((await send("/lookup", { type: "name" }, await session("analyst@bank.test"))).status, 400);
});

test("console feed works with a session", async () => {
  await noticeScheme();
  const body = await J(await get("/feed", await session("regulator@bank.test")));
  assert.equal(body.records[0].entity, "Fixture Scheme");
  const csv = await get("/feed?format=csv", await session("analyst@bank.test"));
  assert.match(csv.headers.get("content-type"), /csv/);
});

/* --- API keys ---------------------------------------------------------- */

test("an org admin creates a key, shown once, and stored only as a hash", async () => {
  const cookie = await session("admin@bank.test");
  const res = await send("/api-keys", { scopes: ["check", "feed"] }, cookie);
  assert.equal(res.status, 201);
  const { key, id, prefix } = await J(res);
  assert.match(key, /^qw_/);

  const stored = await ApiKey.collection.findOne({ orgId: orgs.bank._id });
  assert.ok(!JSON.stringify(stored).includes(key));

  const list = await J(await get("/api-keys", cookie));
  assert.equal(list.keys.length, 1);
  assert.deepEqual(Object.keys(list.keys[0]).sort(), ["created_at", "id", "last_used_at", "prefix", "revoked_at", "scopes"]);
  assert.ok(!JSON.stringify(list).includes(key));
  assert.equal(list.keys[0].id, id);
  assert.equal(list.keys[0].prefix, prefix);

  assert.equal((await post(`${api.url}/v1/check`, { recipient: "x", type: "name" }, { "x-api-key": key })).status, 200);
  assert.equal(await AuditLog.countDocuments({ action: "api_key.create", target: `ApiKey:${id}` }), 1);
});

test("a key works only for its scopes", async () => {
  const { key } = await J(await send("/api-keys", { scopes: ["check"] }, await session("admin@bank.test")));
  assert.equal((await fetch(`${api.url}/v1/feed`, { headers: { "x-api-key": key } })).status, 403);
});

test("a revoked key stops working at once", async () => {
  const cookie = await session("admin@bank.test");
  const { key, id } = await J(await send("/api-keys", { scopes: ["check"] }, cookie));
  assert.equal((await del(`/api-keys/${id}`, cookie)).status, 200);
  assert.equal((await post(`${api.url}/v1/check`, { recipient: "x", type: "name" }, { "x-api-key": key })).status, 401);
  assert.ok((await J(await get("/api-keys", cookie))).keys[0].revoked_at);
  assert.equal(await AuditLog.countDocuments({ action: "api_key.revoke", target: `ApiKey:${id}` }), 1);
});

test("one organisation can't see or revoke another's keys", async () => {
  const { id } = await J(await send("/api-keys", { scopes: ["check"] }, await session("admin@bank.test")));
  const other = await session("admin@other.test");
  assert.deepEqual((await J(await get("/api-keys", other))).keys, []);
  assert.equal((await del(`/api-keys/${id}`, other)).status, 404);
  assert.equal((await ApiKey.findById(id)).revokedAt, null);
});

test("only an org admin manages keys", async () => {
  for (const email of ["analyst@bank.test", "bankreviewer@bank.test", "reviewer@qwench.test", "regulator@bank.test"]) {
    const cookie = await session(email);
    assert.equal((await get("/api-keys", cookie)).status, 403, email);
    assert.equal((await send("/api-keys", { scopes: ["check"] }, cookie)).status, 403, email);
  }
});

test("a bad scope or key id is refused", async () => {
  const cookie = await session("admin@bank.test");
  assert.equal((await send("/api-keys", { scopes: ["everything"] }, cookie)).status, 400);
  assert.equal((await send("/api-keys", { scopes: [] }, cookie)).status, 400);
  assert.equal((await del("/api-keys/not-an-id", cookie)).status, 404);
});

/* --- Review queue ------------------------------------------------------- */

const pendingRecord = async (capturedBy = "capturer@qwench.test", extra = {}) => {
  const entity = await fixtureEntity(`Fixture Pending ${Math.random().toString(36).slice(2)}`);
  return Record.create({ entityId: entity._id, sourceId: source._id, type: "warning", quote: "Fixture quote", capturedBy, ...extra });
};

test("only Qwench's reviewers can use the queue", async () => {
  for (const email of ["analyst@bank.test", "admin@bank.test", "bankreviewer@bank.test", "regulator@bank.test"]) {
    const cookie = await session(email);
    assert.equal((await get("/review-queue", cookie)).status, 403, email);
    assert.equal((await send("/review-queue/000000000000000000000000", { kind: "record", decision: "approve" }, cookie)).status, 403, email);
  }
});

test("the queue lists each kind, and hides who contributed", async () => {
  await pendingRecord();
  await PublicReport.create({ schemeName: "Fixture Report", source: "web", evidenceRefs: ["https://example.test/e"] });
  await Contribution.create({ orgId: orgs.bank._id, schemeName: "Fixture Contribution", terms: "5% a day" });
  await Signal.create({ key: "fixture", weekStart: new Date("2026-10-26"), anomalyFlag: true, checksThisWeek: 40 });
  const a = await fixtureEntity("Fixture A");
  const b = await fixtureEntity("Fixture B");
  await Relation.create({ fromEntity: a._id, toEntity: b._id, type: "impersonates", capturedBy: "capturer@qwench.test" });

  const res = await get("/review-queue", await session("reviewer@qwench.test"));
  const text = await res.text();
  const { items } = JSON.parse(text);
  assert.deepEqual([...new Set(items.map((i) => i.kind))].sort(), ["contribution", "public_report", "record", "relation", "signal"]);
  assert.ok(!text.includes("Fixture Bank"));
  assert.ok(!text.includes(String(orgs.bank._id)));
  assert.ok(items.every((i) => i.can_review === true));
});

test("approving a record makes it live, and is audited", async () => {
  const doc = await pendingRecord();
  const res = await send(`/review-queue/${doc._id}`, { kind: "record", decision: "approve" }, await session("reviewer@qwench.test"));
  assert.equal(res.status, 200);
  const saved = await Record.findById(doc._id);
  assert.equal(saved.status, "active");
  assert.equal(saved.reviewedBy, "reviewer@qwench.test");
  const audit = await AuditLog.findOne({ target: `Record:${doc._id}` }).lean();
  assert.equal(audit.actor, "reviewer@qwench.test");
  assert.equal(audit.action, "record.approve");
  assert.equal(audit.before.status, "pending");
  assert.equal(audit.after.status, "active");
});

test("nobody can approve their own record", async () => {
  const doc = await pendingRecord("Reviewer@Qwench.test");
  const cookie = await session("reviewer@qwench.test");
  const { items } = await J(await get("/review-queue", cookie));
  assert.equal(items.find((i) => i.id === String(doc._id)).can_review, false);
  const res = await send(`/review-queue/${doc._id}`, { kind: "record", decision: "approve" }, cookie);
  assert.equal(res.status, 403);
  assert.equal((await J(res)).error.code, "self_approval");
  assert.equal((await Record.findById(doc._id)).status, "pending");
  assert.equal((await send(`/review-queue/${doc._id}`, { kind: "record", decision: "approve" }, await session("second@qwench.test"))).status, 200);
});

test("a record with no quote can't be approved", async () => {
  const doc = await pendingRecord("capturer@qwench.test", { quote: undefined });
  const res = await send(`/review-queue/${doc._id}`, { kind: "record", decision: "approve" }, await session("reviewer@qwench.test"));
  assert.equal(res.status, 400);
  assert.equal((await J(res)).error.code, "needs_quote");
  assert.equal((await Record.findById(doc._id)).status, "pending");
});

test("a reviewer can add the wording a record is missing, and it's audited", async () => {
  const doc = await pendingRecord("collector:sec", { quote: undefined });
  const res = await send(`/review-queue/${doc._id}`, { kind: "record", decision: "approve", quote: "  Wording from the original.  " }, await session("reviewer@qwench.test"));
  assert.equal(res.status, 200);
  const saved = await Record.findById(doc._id);
  assert.equal(saved.status, "active");
  assert.equal(saved.quote, "Wording from the original.");
  const audit = await AuditLog.findOne({ target: `Record:${doc._id}` }).lean();
  assert.equal(audit.after.quoteAddedByReviewer, true);
});

test("a reviewer can't replace wording taken from the notice", async () => {
  const doc = await pendingRecord();
  await send(`/review-queue/${doc._id}`, { kind: "record", decision: "approve", quote: "Different words" }, await session("reviewer@qwench.test"));
  assert.equal((await Record.findById(doc._id)).quote, "Fixture quote");
});

test("a rejected record is withdrawn", async () => {
  const doc = await pendingRecord();
  await send(`/review-queue/${doc._id}`, { kind: "record", decision: "reject" }, await session("reviewer@qwench.test"));
  assert.equal((await Record.findById(doc._id)).status, "withdrawn");
});

test("an item can only be reviewed once", async () => {
  const doc = await pendingRecord();
  const cookie = await session("reviewer@qwench.test");
  assert.equal((await send(`/review-queue/${doc._id}`, { kind: "record", decision: "approve" }, cookie)).status, 200);
  const res = await send(`/review-queue/${doc._id}`, { kind: "record", decision: "reject" }, cookie);
  assert.equal(res.status, 400);
  assert.equal((await J(res)).error.code, "already_reviewed");
  assert.equal((await Record.findById(doc._id)).status, "active");
});

test("approving an impersonation makes it public", async () => {
  const real = await fixtureEntity("Fixture Real Business");
  const fake = await fixtureEntity("Fixture Fake", "fixture-fake.test");
  const relation = await Relation.create({ fromEntity: fake._id, toEntity: real._id, type: "impersonates", capturedBy: "capturer@qwench.test" });
  const check = () => post(`${api.url}/v1/public/check`, { recipient: "fixture-fake.test", type: "domain" }, addr()).then(J);
  assert.equal((await check()).tier, null);

  const res = await send(`/review-queue/${relation._id}`, { kind: "relation", decision: "approve" }, await session("reviewer@qwench.test"));
  assert.equal(res.status, 200);
  const body = await check();
  assert.equal(body.tier, 2);
  assert.match(body.report.state_sentence, /Fixture Real Business/);
});

test("nobody can approve their own impersonation", async () => {
  const a = await fixtureEntity("Fixture A");
  const b = await fixtureEntity("Fixture B");
  const relation = await Relation.create({ fromEntity: a._id, toEntity: b._id, type: "impersonates", capturedBy: "reviewer@qwench.test" });
  const res = await send(`/review-queue/${relation._id}`, { kind: "relation", decision: "approve" }, await session("reviewer@qwench.test"));
  assert.equal(res.status, 403);
  assert.equal((await Relation.findById(relation._id)).status, "pending");
});

test("reviewing a report confirms or dismisses it, and confirmation keeps it", async () => {
  const report = await PublicReport.create({ schemeName: "Fixture", source: "web" });
  const cookie = await session("reviewer@qwench.test");
  await send(`/review-queue/${report._id}`, { kind: "public_report", decision: "approve" }, cookie);
  const saved = await PublicReport.findById(report._id);
  assert.equal(saved.reviewStatus, "confirmed");
  assert.equal(saved.expiresAt, null);

  const other = await PublicReport.create({ schemeName: "Fixture 2", source: "web" });
  await send(`/review-queue/${other._id}`, { kind: "public_report", decision: "reject" }, cookie);
  assert.equal((await PublicReport.findById(other._id)).reviewStatus, "dismissed");
});

test("a reviewer can't approve their own organisation's contribution", async () => {
  const own = await Contribution.create({ orgId: orgs.qwench._id, schemeName: "Own" });
  const cookie = await session("reviewer@qwench.test");
  assert.equal((await send(`/review-queue/${own._id}`, { kind: "contribution", decision: "approve" }, cookie)).status, 403);
  const theirs = await Contribution.create({ orgId: orgs.bank._id, schemeName: "Theirs" });
  assert.equal((await send(`/review-queue/${theirs._id}`, { kind: "contribution", decision: "approve" }, cookie)).status, 200);
  assert.equal((await Contribution.findById(theirs._id)).reviewStatus, "reviewed");
});

test("reviewing a signal makes it count", async () => {
  const entity = await fixtureEntity("Fixture Spike");
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("name", "Fixture Spike"), origin: "review" });
  const signal = await Signal.create({ key: entity.slug, weekStart: new Date("2026-10-26"), anomalyFlag: true });
  const analyst = await session("analyst@bank.test");
  const lookup = () => send("/lookup", { recipient: "Fixture Spike", type: "name" }, analyst).then(J);
  assert.equal((await lookup()).tier, null);
  await send(`/review-queue/${signal._id}`, { kind: "signal", decision: "approve" }, await session("reviewer@qwench.test"));
  assert.equal((await lookup()).tier, 4);
});

test("bad review requests are refused", async () => {
  const cookie = await session("reviewer@qwench.test");
  const doc = await pendingRecord();
  assert.equal((await send(`/review-queue/${doc._id}`, { kind: "nothing", decision: "approve" }, cookie)).status, 400);
  assert.equal((await send(`/review-queue/${doc._id}`, { kind: "record", decision: "maybe" }, cookie)).status, 400);
  assert.equal((await send("/review-queue/not-an-id", { kind: "record", decision: "approve" }, cookie)).status, 404);
  assert.equal((await send("/review-queue/000000000000000000000000", { kind: "record", decision: "approve" }, cookie)).status, 404);
});

test("the queue keeps demo and real data apart", async () => {
  const demoOrg = await Organization.create({ name: "Demo Qwench", type: "qwench", status: "demo" });
  await user("demo@qwench.test", demoOrg._id, "reviewer");
  const real = await pendingRecord();
  const demo = await pendingRecord("capturer@qwench.test", { isDemo: true });
  const ids = async (email) => (await J(await get("/review-queue", await session(email)))).items.map((i) => i.id);
  assert.deepEqual(await ids("reviewer@qwench.test"), [String(real._id)]);
  assert.deepEqual(await ids("demo@qwench.test"), [String(demo._id)]);
  const res = await send(`/review-queue/${real._id}`, { kind: "record", decision: "approve" }, await session("demo@qwench.test"));
  assert.equal(res.status, 404);
});

test("passwords and tokens never reach the log", async () => {
  const original = { log: console.log, warn: console.warn, error: console.error };
  for (const k of Object.keys(original)) console[k] = (...args) => lines.push(args.join(" "));
  try {
    await login("analyst@bank.test");
    await login("analyst@bank.test", "wrong-secret-password");
  } finally {
    Object.assign(console, original);
  }
  const all = lines.join("\n");
  assert.ok(!all.includes(PASSWORD));
  assert.ok(!all.includes("wrong-secret-password"));
  assert.ok(!all.includes("analyst@bank.test"));
});

/* --- Creating users ----------------------------------------------------- */

test("create-user refuses a weak password, and needs its inputs", () => {
  const run = (args, env = {}) => spawnSync(process.execPath, ["src/scripts/create-user.js", ...args], { env: { ...process.env, MONGODB_URI: "", ...env }, encoding: "utf8", timeout: 30000 });
  const missing = run([]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /usage/);
  const weak = run(["--email", "a@b.test", "--org", "Qwench", "--role", "reviewer"], { QWENCH_USER_PASSWORD: "short" });
  assert.equal(weak.status, 1);
  assert.match(weak.stderr, /12 characters/);
  const role = run(["--email", "a@b.test", "--org", "Qwench", "--role", "emperor"], { QWENCH_USER_PASSWORD: "long-enough-password" });
  assert.equal(role.status, 1);
  assert.match(role.stderr, /role/);
});
