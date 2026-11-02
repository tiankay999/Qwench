/**
 * Scrapes every public page of the running web app and asserts the rules in
 * docs/spec/README.md hold in the HTML a visitor actually receives.
 *
 * Reading the rendered HTML rather than the source is the point: a banned word
 * can arrive from a component, from an API reply, or from a template nobody
 * remembered, and only the page a person is actually served proves it didn't.
 *
 * Needs the backend and the web app running:
 *
 *   cd Backend      && node src/server.js
 *   cd WebAPP/qwench && QWENCH_API_URL=http://localhost:4000 npm run build && npm start
 *   cd WebAPP/qwench && npm run test:compliance
 *
 * Point it elsewhere with WEB=http://host:port.
 */
const BASE = process.env.WEB || "http://localhost:3000";

const PAGES = [
  "/",
  "/about",
  "/community",
  "/for-business",
  "/appeal",
  "/report-scheme",
  "/blog",
  "/blog/what-a-sec-ghana-notice-actually-says",
  "/blog/licensed-is-not-the-same-as-safe",
  "/dashboard",
  "/search",
  "/report/yepbit-trading",
  "/report/menzgold-ghana-limited",
  "/report/databank-financial-services",
];

/** Text only: class names and URLs are not wording shown to a person. */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

const BANNED = [
  ["a risk score", /\brisk score\b|\b\d(?:\.\d)?\s*\/\s*10\b|\bout of 10\b/i],
  ["a traffic-light verdict", /\b(CRITICAL|HIGH|MEDIUM|LOW)\s+RISK\b/i],
  ["advice", /\bwe recommend\b|\byou should (?:invest|pay|avoid)\b|\bexercise caution\b/i],
  ["calling something a scam", /\bscam(?:s|med|mer|mers)?\b/i],
  ["calling something fraudulent", /\bfraudulent\b/i],
  ["calling something verified", /\bverified\b/i],
  ["an unqualified 'is safe'", /\b(?:is|are|it's|its)\s+(?:completely\s+|totally\s+)?safe\b/i],
  ["an 'Official Partner' claim", /official partner/i],
  ["a '50+ sources' claim", /\d+\+\s*sources/i],
  ["a reporter's identity", /reported by [A-Z]/],
  ["a raw Ghana phone number", /\+233\d{9}/],
  ["a dead wa.me placeholder", /wa\.me\/233X+/i],
];

/** The one sentence rule 2 allows, plus the page that explains the rule. */
const ALLOWED_SAFE = [
  "this does not mean it is safe or unsafe",
  "does not mean it is safe or unsafe",
  "licensed” is not the same as safe",
  "licensed is not the same as safe",
  "is not the same as safe",
];

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

const bodies = new Map();

for (const path of PAGES) {
  const res = await fetch(BASE + path);
  const html = await res.text();
  const text = visibleText(html);
  bodies.set(path, { res, html, text });

  console.log(`\n### ${path}`);
  ok("200 OK", res.status === 200, `got ${res.status}`);
  ok("has real content", text.trim().length > 400, `${text.trim().length} chars`);

  for (const [label, re] of BANNED) {
    let hit = text.match(re);

    // "safe" is allowed in the one sentence the spec permits.
    if (hit && label.includes("is safe")) {
      const lowered = text.toLowerCase();
      if (ALLOWED_SAFE.some((phrase) => lowered.includes(phrase))) {
        const stripped = ALLOWED_SAFE.reduce(
          (acc, phrase) => acc.split(phrase).join(" "),
          lowered,
        );
        hit = stripped.match(re);
      }
    }

    ok(`no ${label}`, !hit, hit ? `found "${hit[0]}"` : "");
  }

  ok("carries 'Information, not advice'", /information, not advice/i.test(text));
  ok("carries the SEC Ghana hotline", /0800\s*100\s*065/.test(text));
}

/* ---- what each page must positively contain ---------------------- */
console.log("\n### content checks");

const yepbit = bodies.get("/report/yepbit-trading").text;
ok("YepBit: names SEC Ghana", /SEC Ghana named Yepbit Trading/i.test(yepbit));
ok("YepBit: shows the notice date", /2025-07-15/.test(yepbit));
ok("YepBit: links the source", /sec\.gov\.gh/.test(bodies.get("/report/yepbit-trading").html));
ok("YepBit: shows the legal state", /Named in a notice/i.test(yepbit));
ok("YepBit: shows the evidence level", /Regulator warning/i.test(yepbit));
ok("YepBit: Tier 1 explained", /Tier 1/.test(yepbit));
ok("YepBit: has questions to ask", /Questions to ask/i.test(yepbit));
ok("YepBit: carries the appeal route", /appeal/i.test(yepbit));
ok("YepBit: carries the disclaimer", /not a final ruling/i.test(yepbit));

const databank = bodies.get("/report/databank-financial-services").text;
ok("Databank: on the licensed list", /licensed/i.test(databank));
ok("Databank: states it is not a promise of payment", /doesn't mean an investment will pay|does not mean an investment will pay/i.test(databank));

const home = bodies.get("/").text;
ok("home: real record count from /about", /74/.test(home));
ok("home: data date", /2026-11-02/.test(home));
ok("home: no invented stat labels", !/Scams Flagged|Investments Verified/i.test(home));
ok("home: evidence-based step 3", !/risk score instantly/i.test(home));

const about = bodies.get("/about").text;
ok("about: lists publishers", /SEC Ghana/.test(about) && /Bank of Ghana/.test(about));
ok("about: says what Qwench won't do", /never give a score/i.test(about));

const community = bodies.get("/community").text;
ok("community: explains the review pipeline", /second person/i.test(community));
ok("community: no invented report feed", !/upvote/i.test(community));

console.log(
  `\n${fail === 0 ? "✅ ALL PASS" : "❌ FAILURES"} — ${pass} passed, ${fail} failed`,
);
process.exit(fail === 0 ? 0 : 1);
