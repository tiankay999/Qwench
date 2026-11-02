import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { post, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";
import { buildIdentifier, hashIdentifier } from "../src/lib/identifiers.js";
import { Case, Contribution, Entity, Identifier, Organization, PublicReport, Record, Signal, Source } from "../src/models/index.js";

// A public reply may reveal only regulator and sanctions records, legal states and
// reviewed impersonation. Anything else must be identical to a no-record reply,
// or "no record" becomes a tell. All FIXTURE data.
let api;
let source;
let org;

const NO_RECORD = "+233240000099";
const number = (i) => `+23324000${String(i).padStart(4, "0")}`;
const hash = (n) => hashIdentifier("momo_number", n);
const ids = (n) => [{ type: "momo_number", valueHash: hash(n) }];

async function entityWith(name, n) {
  const entity = await Entity.create({ name, slug: name.toLowerCase().replace(/\W+/g, "-"), kind: "platform" });
  await Identifier.create({ entityId: entity._id, ...buildIdentifier("momo_number", n), origin: "review" });
  return entity;
}

const reports = (n, schemeName, extra = {}) =>
  Promise.all(["whatsapp", "telegram", "web"].map((s) => PublicReport.create({ schemeName, identifiers: ids(n), source: s, reviewStatus: "confirmed", evidenceRefs: ["fixture"], ...extra })));

const HIDDEN = {
  "partner-confirmed": (n) => Contribution.create({ orgId: org._id, schemeName: "Hidden Scheme", identifiers: ids(n), reviewStatus: "reviewed" }),
  "partner-confirmed, with stated terms": (n) => Contribution.create({ orgId: org._id, schemeName: "Hidden Scheme", identifiers: ids(n), terms: "Pays 5% a day, guaranteed", region: "Fixture", lossBand: "Fixture", reviewStatus: "reviewed" }),
  "partner-confirmed, demo data": (n) => Contribution.create({ orgId: org._id, schemeName: "Hidden Scheme", identifiers: ids(n), reviewStatus: "reviewed", isDemo: true }),
  "partner report, not reviewed": (n) => Contribution.create({ orgId: org._id, schemeName: "Hidden Scheme", identifiers: ids(n), terms: "Pays 5% a day", reviewStatus: "pending" }),
  "partner identifier on an entity": async (n) => {
    await entityWith("Hidden Partner Entity", n);
    await Contribution.create({ orgId: org._id, schemeName: "Hidden Partner Entity", identifiers: ids(n), terms: "Pays 5% a day", reviewStatus: "reviewed" });
  },
  "tier 3 reports": (n) => reports(n, "Hidden Scheme"),
  "tier 3 reports on an entity": async (n) => {
    await entityWith("Hidden Reported Entity", n);
    await reports(n, "Hidden Reported Entity");
  },
  "unreviewed reports": (n) => reports(n, "Hidden Scheme", { reviewStatus: "pending" }),
  "tier 4 signal": (n) => Signal.create({ key: hash(n), weekStart: new Date("2026-10-26"), anomalyFlag: true, reviewStatus: "reviewed" }),
  "unreviewed signal": (n) => Signal.create({ key: hash(n), weekStart: new Date("2026-10-26"), anomalyFlag: true, reviewStatus: "pending" }),
  "open case": (n) => Case.create({ caseNumber: `QW-2026-${n.slice(-4)}`, type: "scheme", trigger: "manual", identifiers: ids(n), status: "open" }),
  "pending record": async (n) => {
    const entity = await entityWith("Hidden Pending Entity", n);
    await Record.create({ entityId: entity._id, sourceId: source._id, type: "warning", capturedBy: "capturer" });
  },
  "expired record": async (n) => {
    const entity = await entityWith("Hidden Expired Entity", n);
    await Record.create({ entityId: entity._id, sourceId: source._id, type: "warning", quote: "Fixture", capturedBy: "a", reviewedBy: "b", status: "active", endsOn: new Date("2020-01-01") });
  },
  "withdrawn record": async (n) => {
    const entity = await entityWith("Hidden Withdrawn Entity", n);
    await Record.create({ entityId: entity._id, sourceId: source._id, type: "warning", quote: "Fixture", capturedBy: "a", reviewedBy: "b", status: "withdrawn" });
  },
  "an entity with no records": (n) => entityWith("Hidden Bare Entity", n),
};

const strip = ({ checked_at: _ignored, ...rest }) => rest;

// Each request gets its own address, and must succeed. Two rate-limit errors
// would otherwise compare as equal, and hide a real difference.
let ip = 0;
const v1 = async (n) => {
  ip += 1;
  const res = await post(`${api.url}/v1/public/check`, { recipient: n, type: "momo_number" }, { "x-forwarded-for": `198.51.100.${ip}` });
  assert.equal(res.status, 200);
  return strip(await res.json());
};
const legacy = async (n) => strip((await (await post(`${api.url}/api/check`, { query: n })).json()).data);

const numbers = {};

before(async () => {
  await startDb();
  api = await serve(createApp());
  source = await Source.create({ publisher: "Fixture Regulator", type: "notice", title: "Fixture notice", publishedOn: new Date("2026-07-01") });
  org = await Organization.create({ name: "Fixture Org", type: "bank", status: "demo" });
  let i = 1;
  for (const [label, seed] of Object.entries(HIDDEN)) {
    numbers[label] = number(i);
    await seed(numbers[label]);
    i += 1;
  }
});

after(async () => {
  await api.close();
  await stopDb();
});

for (const label of Object.keys(HIDDEN)) {
  test(`/v1/public/check: ${label} looks exactly like no record`, async () => {
    assert.deepEqual(await v1(numbers[label]), await v1(NO_RECORD));
  });

  test(`/api/check: ${label} looks exactly like no record`, async () => {
    assert.deepEqual(await legacy(numbers[label]), await legacy(NO_RECORD));
  });
}

test("a no-record reply has no internal fields", async () => {
  const body = await v1(NO_RECORD);
  assert.equal(body.match, false);
  assert.equal(body.state, "no_record");
  assert.equal(body.tier, null);
  assert.deepEqual(body.reason_codes, []);
  assert.equal(body.report.return_check, null);
  for (const field of ["allowed_use", "suggested_action", "pending_reports", "pending_records", "value_hash"]) assert.equal(body[field], undefined, field);
});

test("institutions still see partner data, with its stated terms", async () => {
  const { evaluate } = await import("../src/services/evidenceEngine.js");
  const r = await evaluate({ recipient: numbers["partner-confirmed, with stated terms"], type: "momo_number", audience: "institution" });
  assert.equal(r.tier, 2);
  assert.equal(r.return_check.annual_percent, 1825);
});
