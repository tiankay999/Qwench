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

const STATUS_ICON = {
  authority: "🏛️",
  licensed: "✅",
  sandbox: "🧪",
  blacklisted: "❌",
  revoked: "❌",
  unregistered: "⚠️",
  unknown: "⚠️",
};

const SEVERITY_ICON = { critical: "🔴", high: "🟠", medium: "🟡", low: "⚪" };

/** Build the WhatsApp risk report message from an /api/check result. */
export function formatRiskReport(r, { evidenceSummary = "" } = {}) {
  const lines = [];

  lines.push(r.evidenceCount ? "🛡️ *Qwench Risk Report — Evidence-Based*" : "🛡️ *Qwench Risk Report*");
  lines.push(`📌 *${r.name}*`);
  lines.push("");
  lines.push(`Risk Score: ${r.emoji} ${r.riskScore.toFixed(1)}/10 — ${r.riskLevel}`);

  if (r.summary) {
    lines.push("");
    lines.push(`_${r.summary}_`);
  }

  lines.push("");
  lines.push(`${STATUS_ICON[r.status] || "⚠️"} *SEC Status:* ${r.statusLabel}`);
  if (r.citation) lines.push(`⚖️ _${r.citation}_`);

  const isLowRisk = r.riskVerdict === "LOW";

  if (isLowRisk && r.greenFlags?.length) {
    lines.push("");
    lines.push("✅ *What checks out:*");
    r.greenFlags.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
  }

  const flags = r.redFlagsDetailed?.length
    ? r.redFlagsDetailed
    : (r.redFlags || []).map((f) => ({ flag: f, severity: "medium" }));

  if (flags.length) {
    lines.push("");
    lines.push(isLowRisk ? "🟡 *Worth noting:*" : "🚩 *Red Flags Found:*");
    flags.forEach((f, i) => {
      const icon = isLowRisk ? "" : `${SEVERITY_ICON[f.severity] || "🟡"} `;
      lines.push(`${i + 1}. ${icon}${f.flag}`);
    });
  }

  if (r.contract) {
    const c = r.contract;
    lines.push("");
    lines.push(`🔗 *Contract check* (${c.chainName}${c.tokenSymbol ? ` · ${c.tokenSymbol}` : ""})`);
    lines.push(`${c.isHoneypot ? "❌" : "✅"} Honeypot: ${c.isHoneypot ? "YES — you cannot sell" : "not detected"}`);
    lines.push(`${c.isOpenSource ? "✅" : "❌"} Source code: ${c.isOpenSource ? "published" : "not published"}`);
    if (c.hiddenOwner) lines.push("❌ Hidden owner detected");
    if (c.ownerChangeBalance) lines.push("❌ Owner can change your balance");
    if (c.canTakeBackOwnership) lines.push("❌ Ownership can be reclaimed");
    if (c.selfdestruct) lines.push("❌ Contract can self-destruct");
    if (c.holderCount != null) lines.push(`👤 Holders: ${formatNumber(c.holderCount)}`);
  }

  if (r.coingecko) {
    const t = r.coingecko;
    lines.push("");
    lines.push(`🪙 *${t.symbol} market data* (CoinGecko)`);
    lines.push(`💵 Price: $${formatNumber(t.priceUsd)}${t.marketCapRank ? ` · rank #${t.marketCapRank}` : " · unranked"}`);
    lines.push(`📊 Market cap: $${formatNumber(t.marketCapUsd)} · 24h volume: $${formatNumber(t.volume24hUsd)}`);
    if (t.ageDays != null) lines.push(`📅 Age: ${formatNumber(t.ageDays)} days`);
    if (t.exchangeCount) lines.push(`🏦 Listed on ${t.exchangeCount} exchange${t.exchangeCount === 1 ? "" : "s"}`);
  }

  if (r.reportCount > 0) {
    lines.push("");
    lines.push(`👥 *Community:* ${r.reportCount} Qwench user${r.reportCount === 1 ? "" : "s"} reported this scheme`);
  }

  if (evidenceSummary) {
    lines.push("");
    lines.push(evidenceSummary);
  }

  lines.push("");
  lines.push(`💡 *Recommendation:* ${r.recommendation}`);
  lines.push("");
  lines.push(`🔗 Full report: ${WEB_APP_URL}/report/${urlSlug(r.slug)}`);
  lines.push(`📢 Report this: Type "report"`);
  lines.push(`☎️ SEC Ghana: 0800100065`);

  // Shows whether the verdict came from the AI analyzer or the rule fallback.
  if (r.analyzedBy) {
    const by = r.analyzedBy === "ai" ? `AI analysis${r.aiFromCache ? " (cached)" : ""}` : "rule-based scoring";
    lines.push("");
    lines.push(`_Assessed by ${by}. Not financial advice._`);
  }

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

function formatNumber(n) {
  const num = Number(n);
  if (!num) return "0";
  if (num < 1) return num.toPrecision(2);
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
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
  return [
    `🔎 Note: *"${v.query}"* looks like ${icon} *${v.match.name}* — ${v.match.statusLabel}.`,
    "",
    "Checking the name you sent...",
  ].join("\n");
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
  const info = r.authorityInfo || {};
  const lines = [];

  lines.push("🏛️ *Official Body — Not an Investment*");
  lines.push(`📌 *${r.name}*`);
  lines.push("");
  if (info.role) lines.push(`📋 *Role:* ${info.role}`);
  if (info.website) lines.push(`🌐 *Official site:* ${info.website}`);
  if (info.contact) lines.push(`☎️ *Contact:* ${info.contact}`);

  lines.push("");
  lines.push(`${r.summary || `${r.name} is a Ghanaian authority, not a scheme that takes your money.`}`);

  lines.push("");
  lines.push("⚠️ *Watch out:* if anyone asks you to pay this body through mobile money, or claims to invest on its behalf, that is a scam. These bodies do not collect investments from the public.");

  lines.push("");
  lines.push("Send me the name of the *company or scheme* you want checked instead.");
  lines.push("");
  lines.push("☎️ SEC Ghana: 0800100065");

  return lines.join("\n");
}
