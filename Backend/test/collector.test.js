import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

import { post, serve, startDb, stopDb } from "./helpers/setup.js";
import { createApp } from "../src/app.js";
import { documentQuote, isRelevant, namesFromTitle, parseList, parseNotice, splitAliases } from "../src/collectors/parse.js";
import { collect, collectorStatus } from "../src/collectors/run.js";
import { CollectedNotice, CollectorRun, Entity, Identifier, Record, Source } from "../src/models/index.js";

// The wording below is copied from real public notices, to test the parsers. Nothing
// here is loaded as a record: every collected item is pending until a person approves.
before(startDb);
after(stopDb);

const BOG_ADDRESS = "The Head\nFintech and Innovation Department\nThe Bank Square, 42 Castle Road\nRidge, Accra";

const BOG_36 = `BANK OF GHANA
NOTICE NO.BG/GOV/SEC/2026/36
UNLICENSED DIGITAL CREDIT SERVICES PROVIDERS
The Bank wishes to inform the public that the following mobile loan applications
are operating without the requisite licence or authorisation from the Bank of
Ghana:
NO NAME OF LOAN APP NO NAME OF LOAN APP
1 Agile Loan 11 NovaCedi
2 AmanaPay 12 Palm Loan
3 CashWay  13 PocketLoan
4 Foutou Credit 14 Rite Credit
5 HastyCredit 15 SikaCare
6 InsCash 16 SikaNow
7 KudiNow 17 Susu Loan
8 LendAura 18 Taploan Up
9 Lever credit 19 Temivo Cedi
10 LoanGlide 20 Zatuloan
The Bank reiterates that the operations of these entities constitute significant
violations of customer data privacy, consumer protection, and established
regulatory standards.
The Bank Square, 42 Castle Road
Ridge, Accra
Tel: +233 30 273 9650
Website: www.bog.gov.gh`;

const SEC_LIST_HTML = `<table><tr><td>NUMBER</td><td>NAME OF ENTITY</td></tr>
<tr><td>1</td><td>Afri Hub</td></tr><tr><td>2</td><td>Expert (Expect) Option</td></tr>
<tr><td>3</td><td>Quant Vest Stock Exchange (QVSE)</td></tr><tr><td>4</td><td>Infarms/Secure Farm</td></tr></table>
<p>The SEC has NOT licensed any of the above-mentioned entities to operate.</p>`;

const SANDBOX_HTML = `<p>The sandbox participants and their respective approved pilot activities are as follows:</p>
<table><tr><td>NO.</td><td>VIRTUAL ASSET SERVICE PROVIDER</td><td>PILOT ACTIVITY</td></tr>
<tr><td>1</td><td>AFRICOIN GHANA LIMITED</td><td>Asset Tokenization (GOLD)</td></tr>
<tr><td>2</td><td>VAULTA DIGITAL ASSETS LTD</td><td>Asset Tokenization (SECURITIES)</td></tr></table>`;

const YEPBIT = `The SEC wishes to alert the General Public to a suspected fraudulent investment scheme operating
under the name(s) YEPBIT EXCHANGE and BONCHAT, which is soliciting investments from
members of the public. YEPBIT EXCHANGE and BONCHAT are not licensed by the SEC.
Visit yepbit.com for nothing. For further information, email info@sec.gov.gh or see www.sec.gov.gh`;

const MEKANISM = "The SEC states unequivocally that Mekanism Marketing Ltd is NOT licensed, authorized, or approved to operate in Ghana's capital market. Their site is mekanism-fixture.com.";

/* --- Which notices matter ------------------------------------------------- */

for (const title of ["PUBLIC NOTICE: LIST OF ENTITIES OPERATING WITHOUT A LICENSE", "PUBLIC NOTICE: WARNING AGAINST UNLICENSED INVESTMENT SCHEME – MEKANISM MARKETING LTD", "PUBLIC INTEREST WARNING ON PBAY LTD", "INVESTMENT SCAM ALERT– RISE OF FRAUDULENT INVESTMENT SCHEMES IN GHANA", "PUBLIC NOTICE: FULL LIST OF VIRTUAL ASSET SANDBOX PARTICIPANTS", "Public Notice on Menzgold"]) {
  test(`SEC keeps: ${title}`, () => assert.equal(isRelevant("sec", title), true));
}
for (const title of ["SECURITIES INDUSTRY (REGISTRAR) GUIDELINES 2026", "TEMPORARY OFFICE CLOSURE DUE TO FUMIGATION EXERCISE", "Invitation for Tender"]) {
  test(`SEC skips: ${title}`, () => assert.equal(isRelevant("sec", title), false));
}
for (const title of ["Notice No. 36 – Unlicensed Digital Credit Services Providers", "Notice No.27 – Scam Alert – Daily Wealth Guide"]) {
  test(`BoG keeps: ${title}`, () => assert.equal(isRelevant("bog", title), true));
}
for (const title of ["Notice – No.39 – National Competitive Tendering", "Notice No.17 – Misuse, Abuse and Illegal Handling of Ghana Cedi Banknotes"]) {
  test(`BoG skips: ${title}`, () => assert.equal(isRelevant("bog", title), false));
}

/* --- Reading lists --------------------------------------------------------- */

test("reads the Bank of Ghana's two-column list, in order", () => {
  const names = parseList({ text: BOG_36 });
  assert.equal(names.length, 20);
  assert.deepEqual([names[0], names[10], names[19]], ["Agile Loan", "NovaCedi", "Zatuloan"]);
  assert.ok(names.includes("Susu Loan"));
});

test("reads a table of names", () => {
  assert.deepEqual(parseList({ html: SEC_LIST_HTML }), ["Afri Hub", "Expert (Expect) Option", "Quant Vest Stock Exchange (QVSE)", "Infarms/Secure Farm"]);
});

test("takes the name column, not the activity", () => {
  assert.deepEqual(parseList({ html: SANDBOX_HTML }), ["AFRICOIN GHANA LIMITED", "VAULTA DIGITAL ASSETS LTD"]);
});

test("numbers with a gap aren't trusted as a list", () => {
  assert.deepEqual(parseList({ text: "1 Alpha Scheme\n2 Beta Scheme\n5 Gamma Scheme" }), []);
});

test("a single numbered line isn't a list", () => {
  assert.deepEqual(parseList({ text: "1 Alpha Scheme" }), []);
});

test("addresses and dates aren't read as names", () => {
  assert.deepEqual(parseList({ text: "42 Castle Road\nTel: 0800 100 065\n2026 Annual Report" }), []);
});

/* --- Names from titles ------------------------------------------------------ */

for (const [title, names] of [
  ["PUBLIC NOTICE: WARNING AGAINST UNLICENSED INVESTMENT SCHEME – MEKANISM MARKETING LTD", ["MEKANISM MARKETING LTD"]],
  ["PUBLIC NOTICE: WARNING AGAINST YEPBIT EXCHANGE AND BONCHAT PLATFORMS – SUSPECTED FRAUDULENT INVESTMENT SCHEMES", ["YEPBIT EXCHANGE", "BONCHAT"]],
  ["Notice No.27 – Scam Alert – Daily Wealth Guide", ["Daily Wealth Guide"]],
  ["PUBLIC INTEREST WARNING TO THE GENERAL PUBLIC ON TIZAA GHANA FUND", ["TIZAA GHANA FUND"]],
  ["PUBLIC INTEREST WARNING TO INVESTORS REGARDING WISELING ONLINE INVESTMENT COMPANY", ["WISELING ONLINE INVESTMENT COMPANY"]],
  ["PUBLIC INTEREST WARNING ON PBAY LTD", ["PBAY LTD"]],
  ["PUBLIC NOTICE BLACKSHIELD CAPITAL MANAGEMENT UNLICENSED PRODUCT", ["BLACKSHIELD CAPITAL MANAGEMENT"]],
  ["Public Notice on Menzgold", ["Menzgold"]],
  ["INVESTMENT SCAM ALERT– RISE OF FRAUDULENT INVESTMENT SCHEMES IN GHANA", []],
  ["WARNING AGAINST UNAUTHORISED ADVERTISEMENTS ON FRAUDULENT INVESTMENT SCHEMES", []],
  ["LIST OF ENTITIES OPERATING WITHOUT A LICENSE", []],
]) {
  test(`names in: ${title}`, () => assert.deepEqual(namesFromTitle(title), names));
}

/* --- Aliases ---------------------------------------------------------------- */

for (const [name, aliases] of [
  ["Expert (Expect) Option", ["Expert Option", "Expect Option"]],
  ["Quant Vest Stock Exchange (QVSE)", ["Quant Vest Stock Exchange", "QVSE"]],
  ["Infarms/Secure Farm", ["Infarms", "Secure Farm"]],
  ["QX Broker /Qumatix", ["QX Broker", "Qumatix"]],
  ["Afri Hub", []],
  ["Susu Loan", []],
]) {
  test(`aliases of ${name}`, () => assert.deepEqual(splitAliases(name), aliases));
}

/* --- Quotes ------------------------------------------------------------------ */

test("the quote is copied exactly from the notice", () => {
  const quote = documentQuote(BOG_36, "warning");
  assert.match(quote, /operating without the requisite licence or authorisation from the Bank of Ghana/);
  assert.ok(BOG_36.replace(/\s+/g, " ").includes(quote));
});

test("a notice with nothing quotable gets no quote, and none is invented", () => {
  assert.equal(documentQuote("The office will close on Friday.", "warning"), null);
});

/* --- Whole notices ------------------------------------------------------------ */

test("a Bank of Ghana list becomes loan app warnings", () => {
  const parsed = parseNotice({ collector: "bog", title: "Notice No. 36 – Unlicensed Digital Credit Services Providers", text: BOG_36 });
  assert.equal(parsed.recordType, "warning");
  assert.equal(parsed.kind, "app");
  assert.equal(parsed.entities.length, 20);
  assert.ok(parsed.quote);
});

test("a notice with no names goes to a person", () => {
  const parsed = parseNotice({ collector: "sec", title: "INVESTMENT SCAM ALERT– RISE OF FRAUDULENT SCHEMES", text: "Schemes are rising." });
  assert.deepEqual(parsed.entities, []);
  assert.match(parsed.note, /person/);
});

test("the sandbox list becomes sandbox records, with a short name", () => {
  const parsed = parseNotice({ collector: "sec", title: "PUBLIC NOTICE: FULL LIST OF VIRTUAL ASSET SANDBOX PARTICIPANTS", html: SANDBOX_HTML, text: "The sandbox participants and their respective approved pilot activities are as follows: x." });
  assert.equal(parsed.recordType, "sandbox");
  const vaulta = parsed.entities.find((e) => e.name.startsWith("VAULTA"));
  assert.ok(vaulta.aliases.includes("VAULTA DIGITAL ASSETS"));
  assert.ok(!vaulta.aliases.includes("VAULTA"), "a first word alone could match anything");
});

test("websites go on a notice with one name, never the regulator's own", () => {
  const parsed = parseNotice({ collector: "sec", title: "WARNING AGAINST UNLICENSED INVESTMENT SCHEME – MEKANISM MARKETING LTD", text: `${MEKANISM} See www.sec.gov.gh` });
  assert.deepEqual(parsed.entities[0].domains, ["mekanism-fixture.com"]);
});

test("websites on a notice with several names are left for a person", () => {
  const parsed = parseNotice({ collector: "sec", title: "WARNING AGAINST YEPBIT EXCHANGE AND BONCHAT PLATFORMS – SUSPECTED", text: YEPBIT });
  assert.deepEqual(parsed.entities.map((e) => e.domains), [[], []]);
  assert.deepEqual(parsed.websitesForPerson, ["yepbit.com"]);
});

test("phone numbers are never taken from a notice automatically", () => {
  const parsed = parseNotice({ collector: "bog", title: "Notice No. 36 – Unlicensed Digital Credit Services Providers", text: BOG_36 });
  assert.ok(!JSON.stringify(parsed).includes("273 9650"));
});

/* --- Mistakes found by reading the first real run ------------------------------ */

test("section headings in a notice are never read as companies", () => {
  const text = `1 Regulatory Status\n${MEKANISM}\n2 Modus Operandi of the Scheme\nIt promises returns.\n3 Legal Implications\n4 Enforcement Action\n5 Public Advisory`;
  const parsed = parseNotice({ collector: "sec", title: "PUBLIC NOTICE: WARNING AGAINST UNLICENSED INVESTMENT SCHEME – MEKANISM MARKETING LTD", text });
  assert.deepEqual(parsed.entities.map((e) => e.name), ["MEKANISM MARKETING LTD"]);
});

test("a table of TV stations isn't a list of schemes, so it goes to a person", () => {
  const html = "<table><tr><td>1</td><td>Advice TV</td><td>ECO Cash</td></tr><tr><td>2</td><td>Adwempa TV</td><td>RBC Royal Bank</td></tr></table>";
  const parsed = parseNotice({ collector: "sec", title: "WARNING AGAINST UNAUTHORISED ADVERTISEMENTS ON FRAUDULENT INVESTMENT SCHEMES", html, text: "These activities are fraudulent." });
  assert.deepEqual(parsed.entities, []);
  assert.match(parsed.note, /person/);
});

test("the Bank's address doesn't break its list", () => {
  assert.equal(parseList({ text: BOG_36 }).length, 20);
  assert.equal(parseList({ text: `1 Alpha App\n2 Beta App\n${BOG_ADDRESS}` }).length, 2);
});

test("a quote is one sentence, not the whole list", () => {
  const text = "The SEC notifies the public of the following:\nNUMBER NAME OF ENTITY\n1 Afri Hub\n2 BG Wealth\nThe SEC has NOT licensed any of the above-mentioned entities.";
  assert.equal(documentQuote(text, "warning"), "The SEC has NOT licensed any of the above-mentioned entities.");
});

test("the list's wording is quoted from a page's own text, not its table", () => {
  const parsed = parseNotice({ collector: "sec", title: "PUBLIC NOTICE: LIST OF ENTITIES OPERATING WITHOUT A LICENSE", html: SEC_LIST_HTML, text: "" });
  assert.equal(parsed.entities.length, 4);
  assert.equal(parsed.quote, "The SEC has NOT licensed any of the above-mentioned entities to operate.");
});

test("page headings aren't quoted", () => {
  assert.equal(documentQuote("THE SECURITIES AND EXCHANGE COMMISSION PRESS RELEASE OFFICIAL ANNOUNCEMENT OF SANDBOX PARTICIPANTS (NOTICE NO. 5/2026). The office is open.", "sandbox"), null);
});

test("a name with no quotable wording goes to a person too", () => {
  const parsed = parseNotice({ collector: "sec", title: "Public Notice on Menzgold", text: "" });
  assert.equal(parsed.entities[0].name, "Menzgold");
  assert.equal(parsed.quote, null);
  assert.match(parsed.note, /quoted/);
});

/* --- The run ----------------------------------------------------------------- */

const LIST = {
  bog: [
    { id: 36, date: "2026-10-06T10:00:00", modified: "2026-10-06T10:00:00", link: "https://bog.test/36", title: { rendered: "Notice No. 36 &#8211; Unlicensed Digital Credit Services Providers" } },
    { id: 22, date: "2026-07-20T10:00:00", modified: "2026-07-20T10:00:00", link: "https://bog.test/22", title: { rendered: "Notice No.22 &#8211; Unlicensed Digital Credit Services Providers" } },
    { id: 39, date: "2026-10-28T10:00:00", modified: "2026-10-28T10:00:00", link: "https://bog.test/39", title: { rendered: "Notice – No.39 – National Competitive Tendering" } },
  ],
};
const PAGES = {
  "https://bog.test/36": '<article><a href="https://bog.test/36.pdf">Download</a></article>',
  "https://bog.test/22": '<article><a href="https://bog.test/22.pdf">Download</a></article>',
};
const PDFS = {
  "https://bog.test/36.pdf": BOG_36,
  "https://bog.test/22.pdf": `The following mobile loan applications are operating without the requisite licence or authorisation from the Bank of Ghana:\nNO NAME\n1 Agile Loan\n2 Old Only App`,
};

const deps = (extra = {}) => {
  const seen = [];
  return {
    seen,
    fetchList: async (source) => (source.id === "bog" ? LIST.bog : []),
    fetchPage: async (url) => {
      seen.push(url);
      return PAGES[url];
    },
    fetchPdf: async (url) => Buffer.from(PDFS[url]),
    readPdf: async (bytes) => bytes.toString("utf8"),
    wait: async () => {},
    ...extra,
  };
};

beforeEach(async () => {
  await Promise.all([CollectedNotice, CollectorRun, Entity, Identifier, Record, Source].map((m) => m.deleteMany({})));
});

test("a run creates pending records only, from each app's newest notice", async () => {
  const report = await collect(["bog"], deps());
  assert.equal(report.bog.newNotices, 2);
  assert.equal(await Record.countDocuments({ status: { $ne: "pending" } }), 0);
  assert.equal(await Record.countDocuments(), 21);

  const agile = await Entity.findOne({ name: "Agile Loan" });
  assert.equal(agile.kind, "app");
  assert.equal(agile.allowFuzzy, false);
  const records = await Record.find({ entityId: agile._id }).populate("sourceId");
  assert.equal(records.length, 1);
  assert.match(records[0].sourceId.title, /No\. 36/);
  assert.equal(records[0].capturedBy, "collector:bog");
  assert.ok(records[0].quote);
  assert.equal(records[0].reviewedBy, undefined);
});

test("an app only on an older notice still gets a record", async () => {
  await collect(["bog"], deps());
  const old = await Entity.findOne({ name: "Old Only App" });
  const [record] = await Record.find({ entityId: old._id }).populate("sourceId");
  assert.match(record.sourceId.title, /No\.22/);
});

test("the source links to the original, and keeps a fingerprint and copy", async () => {
  await collect(["bog"], deps());
  const source = await Source.findOne({ title: /No\. 36/ });
  assert.equal(source.url, "https://bog.test/36");
  assert.equal(source.archiveUrl, "https://bog.test/36.pdf");
  assert.equal(source.publisher, "Bank of Ghana");
  assert.equal(source.isOfficial, true);
  assert.equal(source.publishedOn.toISOString().slice(0, 10), "2026-10-06");
  const notice = await CollectedNotice.findOne({ externalId: "36" }).select("+document");
  assert.match(notice.contentHash, /^[a-f0-9]{64}$/);
  assert.ok(notice.document.length > 0);
});

test("a second run reads nothing new, and adds nothing", async () => {
  await collect(["bog"], deps());
  const count = await Record.countDocuments();
  const again = deps();
  const report = await collect(["bog"], again);
  assert.equal(report.bog.newNotices, 0);
  assert.deepEqual(again.seen, []);
  assert.equal(await Record.countDocuments(), count);
});

test("a changed notice is read again, without touching what's approved", async () => {
  await collect(["bog"], deps());
  const agile = await Entity.findOne({ name: "Agile Loan" });
  const record = await Record.findOne({ entityId: agile._id });
  record.set({ status: "active", reviewedBy: "person@qwench.test" });
  await record.save();

  const list = [{ ...LIST.bog[0], modified: "2026-11-01T10:00:00" }];
  const report = await collect(["bog"], deps({ fetchList: async () => list, fetchPdf: async () => Buffer.from(`${BOG_36}\n`) }));
  assert.equal(report.bog.changedNotices, 1);
  assert.equal((await Record.findById(record._id)).status, "active");
  assert.equal((await CollectedNotice.findOne({ externalId: "36" })).status, "needs_person");
});

test("a newer notice naming the same app adds a new pending record", async () => {
  await collect(["bog"], deps());
  const newer = { id: 50, date: "2026-12-01T10:00:00", modified: "2026-12-01T10:00:00", link: "https://bog.test/50", title: { rendered: "Notice No.50 - Unlicensed Digital Credit Services Providers" } };
  await collect(["bog"], deps({ fetchList: async () => [newer], fetchPage: async () => '<a href="https://bog.test/50.pdf">x</a>', fetchPdf: async () => Buffer.from(BOG_36) }));
  const agile = await Entity.findOne({ name: "Agile Loan" });
  assert.equal(await Record.countDocuments({ entityId: agile._id }), 2);
});

test("a notice it can't read goes to a person, and the run carries on", async () => {
  const bad = { ...LIST.bog[0], id: 7, link: "https://bog.test/7", title: { rendered: "Notice No.7 - Scam Alert" } };
  const report = await collect(["bog"], deps({ fetchList: async () => [bad, LIST.bog[0]], fetchPage: async (u) => (u.endsWith("/7") ? "<p>Nothing here</p>" : PAGES[u]) }));
  assert.equal(report.bog.needsPerson, 1);
  assert.equal((await CollectedNotice.findOne({ externalId: "7" })).status, "needs_person");
  assert.equal(await Entity.countDocuments({ name: "Agile Loan" }), 1);
});

test("a short name joins the longer one, instead of a duplicate", async () => {
  const items = [
    { id: 2, date: "2026-08-19T10:00:00", modified: "2026-08-19T10:00:00", link: "https://sec.test/2", title: { rendered: "PUBLIC NOTICE: FULL LIST OF VIRTUAL ASSET SANDBOX PARTICIPANTS" } },
    { id: 1, date: "2026-03-10T10:00:00", modified: "2026-03-10T10:00:00", link: "https://sec.test/1", title: { rendered: "PRESS RELEASE: OFFICIAL ANNOUNCEMENT OF VIRTUAL ASSET SANDBOX PARTICIPANTS" } },
  ];
  const older = '<p>The sandbox participants are as follows: x.</p><table><tr><td>1</td><td>VAULTA</td></tr><tr><td>2</td><td>AFRICOIN</td></tr></table>';
  await collect(["sec"], deps({ fetchList: async (s) => (s.id === "sec" ? items : []), fetchPage: async (u) => (u.endsWith("/2") ? SANDBOX_HTML : older) }));
  assert.equal(await Entity.countDocuments(), 2);
  assert.equal(await Record.countDocuments(), 2);
  const { evaluate } = await import("../src/services/evidenceEngine.js");
  const entity = await Entity.findOne({ name: "VAULTA DIGITAL ASSETS LTD" });
  assert.ok(entity.aliases.includes("VAULTA"));
  await Record.findOne({ entityId: entity._id }).then((r) => { r.set({ status: "active", reviewedBy: "person@qwench.test" }); return r.save(); });
  assert.equal((await evaluate({ recipient: "Vaulta", type: "name", audience: "institution" })).state, "sandbox");
});

test("a page that fails is tried again next time", async () => {
  const report = await collect(["bog"], deps({ fetchPage: async () => { throw new Error("down"); } }));
  assert.equal(report.bog.failed, 2);
  assert.equal(await CollectedNotice.countDocuments(), 0);
  assert.equal((await collect(["bog"], deps())).bog.newNotices, 2);
});

test("a failed list is recorded, without stopping other sources", async () => {
  const report = await collect(["bog", "sec"], deps({ fetchList: async (s) => { if (s.id === "bog") throw new Error("down"); return []; } }));
  assert.equal(report.bog.error, "Error");
  assert.equal(report.sec.newNotices, 0);
  const run = await CollectorRun.findOne({ collector: "bog" });
  assert.equal(run.lastError, "Error");
  assert.equal(run.lastSuccessAt, null);
});

test("nothing collected is ever returned by a check", async () => {
  await collect(["bog"], deps());
  const { evaluate } = await import("../src/services/evidenceEngine.js");
  const result = await evaluate({ recipient: "Agile Loan", type: "name" });
  assert.equal(result.match, false);
  assert.equal(result.state, "no_record");
});

test("an approved app gives a regulator warning, with the Bank's quote and link", async () => {
  await collect(["bog"], deps());
  const agile = await Entity.findOne({ name: "Agile Loan" });
  const record = await Record.findOne({ entityId: agile._id });
  record.set({ status: "active", reviewedBy: "person@qwench.test" });
  await record.save();
  const { evaluate } = await import("../src/services/evidenceEngine.js");
  const result = await evaluate({ recipient: "agile loan", type: "name", audience: "institution" });
  assert.equal(result.tier, 1);
  assert.equal(result.report.evidence_level.code, "regulator_warning");
  assert.equal(result.sources[0].publisher, "Bank of Ghana");
  assert.equal(result.sources[0].url, "https://bog.test/36");
  assert.match(result.sources[0].quote, /without the requisite licence/);
});

/* --- Staying current --------------------------------------------------------- */

test("status shows the last run and pending work", async () => {
  await collect(["bog"], deps());
  const status = await collectorStatus();
  const bog = status.collectors.find((c) => c.collector === "bog");
  assert.equal(bog.stale, false);
  assert.ok(bog.last_success_at);
  assert.equal(status.pending_records, 21);
});

test("a source that hasn't worked for a day is stale", async () => {
  await collect(["bog"], deps());
  await CollectorRun.updateOne({ collector: "bog" }, { lastSuccessAt: new Date(Date.now() - 25 * 3_600_000) });
  assert.equal((await collectorStatus()).collectors.find((c) => c.collector === "bog").stale, true);
});

test("a source that has never worked is stale", async () => {
  assert.equal((await collectorStatus()).collectors.find((c) => c.collector === "sec").stale, true);
});

/* --- A person handles the rest, in the console ---------------------------------- */

test("notices needing a person appear in the queue, and can be closed", async () => {
  const { default: bcrypt } = await import("bcrypt");
  const { Organization, User } = await import("../src/models/index.js");
  await Promise.all([Organization.deleteMany({}), User.deleteMany({})]);
  const org = await Organization.create({ name: "Qwench", type: "qwench" });
  await User.create({ email: "r@qwench.test", orgId: org._id, role: "reviewer", passwordHash: await bcrypt.hash("fixture-password-1", 4) });
  const notice = await CollectedNotice.create({ collector: "bog", externalId: "7", title: "Notice No.7 - Scam Alert", url: "https://bog.test/7", publishedOn: new Date(), status: "needs_person", note: "No names found" });

  const api = await serve(createApp());
  const login = await post(`${api.url}/v1/console/login`, { email: "r@qwench.test", password: "fixture-password-1" }, { "x-forwarded-for": "198.18.7.7" });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const { items } = await (await fetch(`${api.url}/v1/console/review-queue`, { headers: { cookie } })).json();
  const item = items.find((i) => i.kind === "notice");
  assert.equal(item.title, "Notice No.7 - Scam Alert");
  assert.equal(item.url, "https://bog.test/7");

  const res = await post(`${api.url}/v1/console/review-queue/${notice._id}`, { kind: "notice", decision: "approve" }, { cookie });
  assert.equal(res.status, 200);
  assert.equal((await CollectedNotice.findById(notice._id)).status, "handled");

  const status = await (await fetch(`${api.url}/v1/console/collectors`, { headers: { cookie } })).json();
  assert.ok(status.collectors.length >= 2);
  assert.equal((await fetch(`${api.url}/v1/console/collectors`)).status, 401);
  await api.close();
});
