import assert from "node:assert/strict";
import { test } from "node:test";

process.env.HMAC_SECRET_KEY = "test-only-hmac-secret-key";

const { ALL_TEMPLATES, NO_RECORD_SENTENCE, buildReport, returnCheck } = await import("../src/engine/report.js");
const { extract, mergeAiCandidates, warningSigns } = await import("../src/engine/extract.js");

const ALLOWED = "This does not mean it is safe or unsafe.";
const BANNED = /\b(safe|unsafe|scam|scams|verified|fraudulent|fraud|legit|legitimate|recommend|should)\b/i;

/* --- Banned words ------------------------------------------------- */

for (const [name, text] of Object.entries(ALL_TEMPLATES)) {
  test(`banned words: template ${name}`, () => {
    assert.doesNotMatch(String(text).replace(ALLOWED, ""), BANNED);
  });
}

const STATES = ["named_in_notice", "licensed", "sandbox", "registered", "authority", "no_record"];
const SAMPLE = {
  entity: "Fixture",
  sources: [{ publisher: "Fixture Regulator", date: "2026-07-01", url: "https://example.test", record_type: "warning", license_type: "Fund Manager", ends_on: "2027-01-01" }],
  dataDate: "2026-11-01",
};

for (const state of STATES) {
  for (const isDemo of [false, true]) {
    test(`banned words: a full ${state} report (demo ${isDemo})`, () => {
      const report = buildReport({
        ...SAMPLE,
        state,
        isDemo,
        didYouMean: state === "no_record" ? { suggested_entity: "Fixture" } : undefined,
        foreignContext: [{ jurisdiction: "GB", publisher: "Fixture Abroad" }],
        merchantClaim: state === "registered" ? { business: "Fixture" } : undefined,
        text: "Earn 5% a day. Guaranteed returns. Refer 5 friends. Only today. Pay registration fee.",
      });
      const words = JSON.stringify(report).replace(ALLOWED, "");
      assert.doesNotMatch(words, BANNED);
    });
  }
}

/* --- Report shape ------------------------------------------------- */

test("banned words: an impersonation report", () => {
  const report = buildReport({ state: "no_record", entity: "Fixture", impersonated: "Fixture Business", sources: [], dataDate: "2026-11-01" });
  assert.match(report.state_sentence, /Fixture Business/);
  assert.doesNotMatch(JSON.stringify(report), BANNED);
});

test("every report has the fixed parts, in order", () => {
  const report = buildReport({ ...SAMPLE, state: "named_in_notice" });
  assert.deepEqual(Object.keys(report), ["state_sentence", "foreign_context", "also_checked", "sources", "return_check", "warning_signs", "questions_to_ask", "notes", "footer"]);
});

test("no record says it isn't a clean result", () => {
  const report = buildReport({ state: "no_record", sources: [], dataDate: "2026-11-01" });
  assert.equal(report.state_sentence, `No record found. ${ALLOWED}`);
  assert.equal(NO_RECORD_SENTENCE, `No record found. ${ALLOWED}`);
});

test("a notice sentence gives the publisher and date", () => {
  const report = buildReport({ ...SAMPLE, state: "named_in_notice" });
  assert.match(report.state_sentence, /Fixture Regulator/);
  assert.match(report.state_sentence, /2026-07-01/);
});

test("a sandbox sentence says it is not a full licence", () => {
  const report = buildReport({ ...SAMPLE, state: "sandbox" });
  assert.match(report.state_sentence, /sandbox/i);
  assert.match(report.state_sentence, /not a full licence/i);
  assert.deepEqual(report.warning_signs, []);
});

test("the footer gives the data date, both numbers and the disclaimer", () => {
  const { footer } = buildReport({ ...SAMPLE, state: "licensed" });
  assert.match(footer, /2026-11-01/);
  assert.match(footer, /0800 100 065/);
  assert.match(footer, /292/);
  assert.match(footer, /Information, not advice\./);
});

test("a report with no data date doesn't invent one", () => {
  const { footer } = buildReport({ state: "no_record", sources: [], dataDate: null });
  assert.doesNotMatch(footer, /\d{4}-\d{2}-\d{2}/);
  assert.match(footer, /no reviewed records/i);
});

test("demo reports start with a label", () => {
  assert.match(buildReport({ ...SAMPLE, state: "named_in_notice", isDemo: true }).state_sentence, /^Demo data/);
});

/* --- Return check ------------------------------------------------- */

for (const [text, stated, annual] of [
  ["Earn 5% a day", "5% a day", 1825],
  ["5% daily", "5% a day", 1825],
  ["2.5 % per day", "2.5% a day", 912.5],
  ["10% a week", "10% a week", 520],
  ["15% monthly", "15% a month", 180],
  ["20% per month", "20% a month", 240],
  ["30% a year", "30% a year", 30],
]) {
  test(`return check: "${text}"`, () => {
    const check = returnCheck(text);
    assert.equal(check.stated, stated);
    assert.equal(check.annual_percent, annual);
    assert.match(check.note, /simple multiplication/i);
  });
}

test("the 5% a day case reads as about 1,825% a year", () => {
  assert.match(returnCheck("Earn 5% a day").note, /about 1,825% a year/);
});

test("no stated return gives no return check", () => {
  assert.equal(returnCheck("Join our group"), null);
  assert.equal(returnCheck(""), null);
  assert.equal(returnCheck(undefined), null);
});

test("a discount isn't a return", () => {
  assert.equal(returnCheck("Get 5% off today"), null);
});

/* --- Warning signs ------------------------------------------------ */

test("warning signs describe what the message says", () => {
  const signs = warningSigns("Guaranteed returns! Refer 5 friends and earn. Only today. Pay a registration fee to join.");
  assert.ok(signs.length >= 4);
  for (const sign of signs) assert.match(sign, /^The message /);
});

test("a plain message has no warning signs", () => {
  assert.deepEqual(warningSigns("Your parcel arrives on Tuesday"), []);
  assert.deepEqual(warningSigns(""), []);
});

/* --- Extract ------------------------------------------------------ */

test("numbers in every format become +233", () => {
  for (const text of ["pay 0241234567 now", "pay 233241234567 now", "pay +233 24 123 4567 now"]) {
    assert.deepEqual(extract(text).numbers, ["+233241234567"], text);
  }
});

test("domains lose the protocol, www and path", () => {
  assert.deepEqual(extract("See https://www.Fixture-Site.test/join?x=1 today").domains, ["fixture-site.test"]);
  assert.deepEqual(extract("visit fixture-site.com.gh").domains, ["fixture-site.com.gh"]);
});

test("an EVM wallet is lowercased", () => {
  const wallet = `0x${"AB".repeat(20)}`;
  assert.deepEqual(extract(`send to ${wallet}`).wallets, [wallet.toLowerCase()]);
});

test("TikTok and Telegram links are recorded, not treated as domains to fetch", () => {
  const out = extract("Join t.me/fixturegroup and https://www.tiktok.com/@fixturepage");
  assert.deepEqual([...out.manual_review].sort(), ["t.me/fixturegroup", "tiktok.com/@fixturepage"]);
  assert.deepEqual(out.domains, []);
});

test("sentences aren't read as domains, and short numbers aren't read as phones", () => {
  const out = extract("It works.Great offer. Call 12345. Earn 5% a day.");
  assert.deepEqual(out.numbers, []);
  assert.deepEqual(out.domains, []);
});

test("an empty message extracts nothing", () => {
  assert.deepEqual(extract(""), { names: [], domains: [], links: [], numbers: [], wallets: [], manual_review: [] });
});

/* --- AI candidates ------------------------------------------------ */

test("an AI candidate must literally appear in the message", () => {
  const text = "Join Fixture Group and pay 0241234567";
  const merged = mergeAiCandidates(extract(text), { entities_mentioned: ["Fixture Group", "Invented Name"], numbers_found: ["0241234567", "0550000000"], domains_found: ["invented.test"] }, text);
  assert.deepEqual(merged.names, ["Fixture Group"]);
  assert.deepEqual(merged.numbers, ["+233241234567"]);
  assert.deepEqual(merged.domains, []);
});

test("a payment method or platform isn't treated as a company name", () => {
  const text = "Pay by MoMo to Fixture Group, or ask on WhatsApp";
  const merged = mergeAiCandidates(extract(text), { entities_mentioned: ["MoMo", "Fixture Group", "WhatsApp"] }, text);
  assert.deepEqual(merged.names, ["Fixture Group"]);
});

test("no AI output leaves the rule results unchanged", () => {
  const text = "pay 0241234567";
  const rules = extract(text);
  assert.deepEqual(mergeAiCandidates(rules, null, text), rules);
  assert.deepEqual(mergeAiCandidates(rules, { error: "down" }, text), rules);
});
