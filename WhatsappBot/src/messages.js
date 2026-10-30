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
🟢 0-3 LOW RISK  🟡 4-6 MEDIUM RISK  🔴 7-10 HIGH RISK

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

const STATUS_ICON = { licensed: "✅", blacklisted: "❌", revoked: "❌", unknown: "⚠️" };

/** Build the WhatsApp risk report message from an /api/check result. */
export function formatRiskReport(r) {
  const lines = [];

  lines.push("🛡️ *Qwench Risk Report*");
  lines.push(`📌 *${r.name}*`);
  lines.push("");
  lines.push(`Risk Score: ${r.emoji} ${r.riskScore.toFixed(1)}/10 — ${r.riskLevel}`);
  lines.push("");
  lines.push(`${STATUS_ICON[r.status] || "⚠️"} *SEC Status:* ${r.statusLabel}`);

  const isLowRisk = r.riskLevel === "LOW RISK";

  if (isLowRisk && r.greenFlags?.length) {
    lines.push("");
    lines.push("✅ *What checks out:*");
    r.greenFlags.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
  }

  if (r.redFlags?.length) {
    lines.push("");
    lines.push(isLowRisk ? "🟡 *Worth noting:*" : "🚩 *Red Flags Found:*");
    r.redFlags.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
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

  lines.push("");
  lines.push(`💡 *Recommendation:* ${r.recommendation}`);
  lines.push("");
  lines.push(`🔗 Full report: ${WEB_APP_URL}/report/${urlSlug(r.slug)}`);
  lines.push(`📢 Report this: Type "report"`);

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
