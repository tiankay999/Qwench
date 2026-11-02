// DEPRECATED — replaced by the evidence-based bot in src/core/.
//
// The old reply templates, including riskScore/riskVerdict/recommendation.
// Nothing imports this any more. WhatsApp and Telegram both go through
// src/core/handler.js, which renders the report the API already builds.

const WEB_APP_URL = (process.env.WEB_APP_URL || "http://localhost:5173").replace(/\/$/, "");

export const WELCOME = `🛡️ Welcome to Qwench — your investment protection assistant.

Send me any company name, token, or investment link and I'll tell you if it's safe.

Or type:
• check — Verify an investment
• report — Report a suspicious scheme
• help — How Qwench works`;

export const HELP = `🛡️ *How Qwench works*

Send me the name of any company, token, investment link or contract address.
I check it against:

🏛️ *SEC Ghana licensed list* — is this entity actually authorised to take your money?
🚫 *SEC Ghana & EOCO warnings* — has it been publicly blacklisted?
🪙 *Live CoinGecko data* — does the token really exist, and does it trade?
🔗 *Contract security* — for 0x addresses, is it a honeypot you cannot sell out of?
👥 *Community reports* — how many Ghanaians have reported it to Qwench?
⏳ *Track record* — how long has it really been operating?

You get back a risk score from 0 to 10:
🟢 0-3 LOW  🟡 3-6 MEDIUM  🟠 6-8 HIGH  🔴 8-10 CRITICAL

*Commands*
• check — Verify an investment
• report — Report a suspicious scheme
• trending — Most-reported schemes right now
• help — This message

_Qwench is an awareness tool, not financial advice. Always confirm a licence directly with SEC Ghana at sec.gov.gh._`;

export const CHECK_PROMPT = `🔍 What would you like me to check?

Send a company name, token symbol, investment link or 0x contract address.

_Examples: Menzgold · Expert Option · Databank · BTC · 0x…_`;

export const REPORT_ASK_NAME = `📢 *Report a suspicious scheme*

What is the name of the scheme or company?

_Type "cancel" to stop._`;

export const REPORT_ASK_SOURCE = `Thanks. How did you hear about it?

*1.* WhatsApp group
*2.* Social media
*3.* Friend / family
*4.* Other

_Reply with a number (1-4)._`;

export const REPORT_CONFIRMED = `✅ Thanks! Your report has been submitted. We'll investigate and warn others.`;

export const REPORT_CANCELLED = `No problem — report cancelled. Type *check* whenever you want to verify something.`;

export const INVALID_SOURCE = `Please reply with a number from *1* to *4*.

*1.* WhatsApp group
*2.* Social media
*3.* Friend / family
*4.* Other`;

export const CHECKING = (query) => `🔍 Checking *${query}* against SEC Ghana records and community reports...`;

export const API_ERROR = `⚠️ I couldn't reach the Qwench servers just now. Please try again in a moment.`;

/* ------------------------------------------------------------------ *
 * Risk report formatting
 * ------------------------------------------------------------------ */

/**
 * Build the WhatsApp report from an /api/check evidence result.
 *
 * There is no score, verdict, colour or recommendation here. The reply states
 * the entity's legal standing, what evidence sits behind it, who published
 * that evidence, and what the person should go and ask. Every line comes from
 * a fixed template -- none of it is generated.
 */
const STATE_HEADER = {
  named_in_notice: "❌ *Named in a regulator notice*",
  licensed: "✅ *Licensed by SEC Ghana*",
  sandbox: "🧪 *Provisional sandbox approval*",
  registered: "🏛️ *Registered body*",
  no_record: "⚠️ *No record found*",
};

const STATE_MEANING = {
  named_in_notice: "A regulator has published a warning naming this. It is not licensed to take your money.",
  licensed: "This is a legal status: the entity holds a current SEC Ghana licence. It is not a warning.",
  sandbox:
    "This is a legal status, not a warning — but sandbox approval is provisional (12 months), not a full licence.",
  registered: "This is an official body, not an investment you can put money into.",
  no_record: "I have no record of this. That does not mean it is safe, and it does not mean it is unsafe.",
};

const TIER_MEANING = {
  1: "Published by a regulator",
  2: "Confirmed by a member institution",
  3: "Corroborated by several independent reports",
  4: "Rising number of checks — being watched",
};

const ACTION_LINE = {
  warn: "🚩 Treat this as a warning. Do not send money.",
  warn_or_confirmation_call: "📞 Confirm directly with the business through a number you already trust.",
  internal_review: "🔍 Under review — no public finding yet.",
  watch: "👀 Being watched. Nothing confirmed.",
  none: "",
};

export function formatRiskReport(r, { evidenceSummary = "", legitMatch = null } = {}) {
  const lines = [];

  lines.push("🛡️ *Qwench Check*");
  if (r.entity) lines.push(`📌 *${r.entity}*`);
  lines.push("");

  // "No record" must not be said when we actually hold evidence. An entity we
  // recognise, or any evidence tier, means the plain no-record wording would
  // contradict the rest of the message.
  if (r.state === "no_record" && r.pending_records > 0) {
    // We hold something on this entity, but it has not cleared review, so it
    // cannot be used as a finding yet. Saying "nothing known" would be false.
    lines.push("📋 *On file — awaiting review*");
    lines.push(
      `Qwench holds ${r.pending_records} record${r.pending_records === 1 ? "" : "s"} on this name that a reviewer has not signed off yet, so I can't report what they say.`
    );
    lines.push("");
    lines.push("Verify directly with SEC Ghana on 0800100065 before you act.");
  } else if (r.state === "no_record" && (r.match || r.tier)) {
    lines.push("⚠️ *No current regulatory record*");
    lines.push(
      r.tier
        ? "No regulator has published a notice naming this, but there is other evidence against it — see below."
        : "I know this name, but no regulator has published anything about it. That is not a clean bill of health."
    );
  } else {
    lines.push(STATE_HEADER[r.state] || STATE_HEADER.no_record);
    lines.push(STATE_MEANING[r.state] || STATE_MEANING.no_record);
  }

  // Evidence tier, said plainly rather than as a number on its own.
  if (r.tier) {
    lines.push("");
    lines.push(`📊 *Evidence:* Tier ${r.tier} — ${TIER_MEANING[r.tier]}`);
  }

  if (r.sources?.length) {
    lines.push("");
    lines.push("📰 *Published by:*");
    r.sources.forEach((s) => lines.push(`• ${s.publisher}${s.date ? ` — ${s.date}` : ""}`));
  }

  if (r.warning_signs?.length) {
    lines.push("");
    lines.push("🔎 *What we found:*");
    r.warning_signs.slice(0, 6).forEach((w, i) => lines.push(`${i + 1}. ${w}`));
  }

  // The return claim is already listed above when it came through as a warning
  // sign; only surface it separately when it is not already there.
  if (r.return_check?.warning && !(r.warning_signs || []).includes(r.return_check.warning)) {
    lines.push("");
    lines.push(`💸 ${r.return_check.warning}`);
  }

  if (evidenceSummary) {
    lines.push("");
    lines.push(evidenceSummary);
  }

  const action = ACTION_LINE[r.suggested_action];
  if (action) {
    lines.push("");
    lines.push(action);
  }

  if (r.questions_to_ask?.length) {
    lines.push("");
    lines.push("❓ *Ask them:*");
    r.questions_to_ask.forEach((q) => lines.push(`• ${q}`));
  }

  // If a registered company sits near this name, the user must leave knowing
  // where the real one is -- that is the whole point of checking.
  if (legitMatch) lines.push(formatRegisteredAlternative(legitMatch));

  lines.push("");
  if (r.entity_slug) lines.push(`🔗 Full report: ${WEB_APP_URL}/report/${urlSlug(r.entity_slug)}`);
  lines.push(`📢 Report this: Type "report"`);
  lines.push(`☎️ SEC Ghana: 0800100065`);

  lines.push("");
  lines.push("_Based on published regulatory records. Not financial advice._");

  return lines.join("\n");
}

/** Build the trending-schemes message from an /api/trending result. */
export function formatTrending(items) {
  if (!items?.length) {
    return `📊 No community reports yet. Be the first — type *report* to flag a suspicious scheme.`;
  }

  const lines = ["📊 *Most-reported schemes on Qwench*", ""];
  items.forEach((item, i) => {
    lines.push(`${i + 1}. *${item.schemeName}* — ${item.reportCount} report${item.reportCount === 1 ? "" : "s"}`);
  });
  lines.push("");
  lines.push(`Send any name to run a full risk check on it.`);
  return lines.join("\n");
}

/** "expert option" -> "expert-option", so the link is clickable in WhatsApp. */
function urlSlug(slug) {
  return encodeURIComponent(String(slug || "").trim().replace(/\s+/g, "-"));
}


/* ------------------------------------------------------------------ *
 * Name verification / anti-spoofing
 * ------------------------------------------------------------------ */

const MATCH_ICON = { licensed: "✅", sandbox: "🧪", blacklisted: "❌", revoked: "❌" };

/** Asks the user whether they meant the registered name or the look-alike. */
export function formatSpoofConfirmation(v) {
  const icon = MATCH_ICON[v.match.status] || "⚠️";
  const lines = [];

  lines.push("⚠️ *Name Verification Required*");
  lines.push("");
  lines.push(`You searched for: *${v.query}*`);
  lines.push("");
  lines.push("This name is similar to a registered entity:");
  lines.push(`${icon} *${v.match.name}* — ${v.match.statusLabel}`);
  lines.push("");
  lines.push(`⚠️ However, *"${v.query}"* is NOT the registered name.`);

  if (v.spoofIndicators?.length) {
    lines.push("");
    lines.push(`🔎 What we noticed: ${v.spoofIndicators.join("; ")}`);
  }

  lines.push("");
  lines.push(
    "Scammers often use names that look like real companies. Small differences like extra letters, numbers, or added words are common tactics."
  );
  lines.push("");
  lines.push("👉 Did you mean:");
  lines.push(`1️⃣ *${v.match.name}* (the registered entity)`);
  lines.push(`2️⃣ *${v.query}* (investigate this name separately)`);
  lines.push("");
  lines.push("Reply *1* or *2*");

  return lines.join("\n");
}

export const SPOOF_INVALID_CHOICE = `Please reply *1* or *2*.

1️⃣ The registered entity
2️⃣ The name you typed, investigated separately

_Or send a different name to start over._`;

/** Blacklisted look-alike: no choice offered, we just say what it is. */
export function formatBlacklistVariantAlert(v) {
  return [
    "🔴 *Spoofing Alert*",
    "",
    `*"${v.query}"* is a name variant of SEC Ghana-blacklisted entity *"${v.match.name}"*.`,
    "",
    'Added words like "Premium", "Official", or "GH" do not make it a different company. This is a common scam tactic.',
    "",
    "Proceeding with full risk analysis...",
  ].join("\n");
}

/** Loose similarity: proceed, but say what it resembles. */
export function formatSoftWarning(v) {
  const icon = MATCH_ICON[v.match.status] || "⚠️";
  const lines = [];

  if (v.isSameEntity && v.matchIsLegit) {
    // They typed the company's informal name. Confirm the registered one so
    // they know exactly who they are dealing with.
    lines.push(`${icon} *${v.match.name}* is the registered name for that.`);
    lines.push(`   ${v.match.statusLabel}${v.match.licenseType ? ` — ${v.match.licenseType}` : ""}`);
  } else {
    lines.push(`🔎 Note: *"${v.query}"* looks like ${icon} *${v.match.name}* — ${v.match.statusLabel}.`);
  }

  lines.push("");
  lines.push("Checking the name you sent...");
  return lines.join("\n");
}

/* ------------------------------------------------------------------ *
 * Evidence flow -- used when we genuinely cannot verify an entity
 * ------------------------------------------------------------------ */

export function formatNeedMoreInfo(entityName) {
  return [
    "🔍 *Need More Information*",
    "",
    `I couldn't find *"${entityName}"* in SEC Ghana's database or any crypto registry.`,
    "",
    "This doesn't mean it's safe OR a scam — I just don't have enough data yet.",
    "",
    "📎 *Send me any of the following to help investigate:*",
    "",
    "1️⃣ 📸 *Screenshot* — of their website, app, WhatsApp group, or social media ad",
    "2️⃣ 🔗 *URL/Link* — their website or social media page",
    "3️⃣ 💬 *Message/Flyer* — forward me any promotional message or image they sent you",
    "",
    "I'll analyze what you send and give you a proper verdict.",
    "",
    "_Type *done* when finished, or *skip* for a verdict without evidence._",
  ].join("\n");
}

/** Acknowledges one piece of evidence and nudges for more. */
export function formatEvidenceReceived({ kind, analysis, count, max }) {
  const lines = ["✅ *Evidence received and analyzed*", ""];

  const label = kind === "image" ? "📸 Image" : kind === "url" ? "🔗 Link" : "💬 Note";
  lines.push(`${label}: ${analysis?.summary || "recorded"}`);

  const flagCount = analysis?.redFlags?.length || 0;
  if (flagCount) {
    lines.push(`🚩 Red flags detected: ${flagCount}`);
    analysis.redFlags.slice(0, 3).forEach((f) => lines.push(`   • ${f.flag}`));
  }

  if (analysis?.returnPromises) lines.push(`💸 Return claims found: ${analysis.returnPromises}`);

  lines.push("");
  lines.push(
    count >= max
      ? `That's ${count} of ${max} items — generating your final report now...`
      : `📎 Send more evidence (${count}/${max}) or type *done* to get your final report.`
  );

  return lines.join("\n");
}

export const EVIDENCE_NOTE_SAVED = `✅ Noted. Send more evidence (images, links) or type *done* for your report.`;

export const EVIDENCE_NONE_YET = `You haven't sent any evidence yet.

Send a screenshot or link, or type *skip* for a verdict based only on what I already know.`;

export const EVIDENCE_ANALYZING = `🔍 Analyzing what you sent...`;

export const EVIDENCE_IMAGE_FAILED = `⚠️ I couldn't read that image. Try a clearer screenshot, send a link instead, or type *done*.`;

export const EVIDENCE_CANCELLED = `No problem — stopping there. Send any company name, token or link whenever you want another check.`;

/** Header shown above the final report when the user supplied evidence. */
export function formatEvidenceSummary(counts) {
  const parts = [];
  if (counts.images) parts.push(`• ${counts.images} screenshot${counts.images === 1 ? "" : "s"} examined`);
  if (counts.urls) parts.push(`• ${counts.urls} website${counts.urls === 1 ? "" : "s"} scraped and analyzed`);
  if (counts.texts) parts.push(`• ${counts.texts} message${counts.texts === 1 ? "" : "s"} reviewed`);
  if (!parts.length) return "";
  return ["📊 *Evidence Analyzed:*", ...parts].join("\n");
}

/**
 * A regulator or government body is not an investment, so it gets an
 * informational card rather than a risk score. Showing SEC Ghana a "risk
 * verdict" would undercut the advice Qwench gives in every other message.
 */
export function formatAuthorityCard(r) {
  const name = r.entity || r.name || "This body";
  const lines = [];

  lines.push("🏛️ *Official Body — Not an Investment*");
  lines.push(`📌 *${name}*`);
  lines.push("");

  if (r.sources?.length) {
    lines.push(`📰 *On record via:* ${r.sources.map((s) => s.publisher).join(", ")}`);
    lines.push("");
  }

  lines.push(`${name} is a Ghanaian regulator or government body, not a scheme that takes your money.`);

  lines.push("");
  lines.push("⚠️ *Watch out:* if anyone asks you to pay this body through mobile money, or claims to invest on its behalf, that is a scam. These bodies do not collect investments from the public.");

  lines.push("");
  lines.push("Send me the name of the *company or scheme* you want checked instead.");
  lines.push("");
  lines.push("☎️ SEC Ghana: 0800100065");

  return lines.join("\n");
}

/**
 * A REGISTERED company sits close to what the user typed, and the query itself
 * is not obviously an impersonation attempt. Show them the real one: someone
 * may simply not know the company's exact registered name.
 */
export function formatLegitLookalike(v) {
  const icon = MATCH_ICON[v.match.status] || "✅";
  const lines = [];

  lines.push("✅ *A registered company matches that name*");
  lines.push("");
  lines.push(`You searched for: *${v.query}*`);
  lines.push("");
  lines.push("There is a real, registered entity with a similar name:");
  lines.push(`${icon} *${v.match.name}*`);
  lines.push(`   ${v.match.statusLabel}${v.match.licenseType ? ` — ${v.match.licenseType}` : ""}`);
  lines.push("");
  lines.push(`But *"${v.query}"* is not how it is registered, so I want to be sure which one you mean.`);
  lines.push("");
  lines.push("👉 Which should I check?");
  lines.push(`1️⃣ *${v.match.name}* (the registered company)`);
  lines.push(`2️⃣ *${v.query}* (exactly what you typed)`);
  lines.push("");
  lines.push("Reply *1* or *2*");

  return lines.join("\n");
}

/**
 * Footer appended to a risk report when a legitimate registered entity sits
 * near the name that was checked -- so the user always leaves knowing where
 * the real company is.
 */
export function formatRegisteredAlternative(match) {
  if (!match) return "";
  const icon = MATCH_ICON[match.status] || "✅";
  return [
    "",
    `${icon} *The registered company with a similar name is:*`,
    `*${match.name}* — ${match.statusLabel}${match.licenseType ? ` (${match.licenseType})` : ""}`,
    `_Send me "${match.name}" to check that one instead._`,
  ].join("\n");
}
