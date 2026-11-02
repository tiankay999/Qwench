/**
 * Renders the API's report into a chat message.
 *
 * The wording is built by the backend (src/engine/report.js) from fixed
 * templates. The bot only lays it out. Keeping the sentences in one place
 * means WhatsApp, Telegram and the web app can never say different things
 * about the same entity, and a correction lands everywhere at once.
 *
 * NEVER in a reply: scores, ratings, risk colours, "we recommend", "this is
 * safe/unsafe", who checked, who reported, or anyone's number.
 */

const STATE_ICON = {
  named_in_notice: "⚠️",
  licensed: "✅",
  sandbox: "🔶",
  authority: "🏛️",
  registered: "ℹ️",
  no_record: "🔍",
};

const WELCOME = `👋 Welcome to Qwench — Ghana's investment verification service.

We check names, numbers, and links against official SEC Ghana notices, licences, and community reports. We don't store your phone number or messages.

Send any company name, phone number, URL, or screenshot to check.`;

export const HELP = `${WELCOME}

Commands:
• *REPORT* — tell us about a scheme
• *CANCEL* — stop what you're doing

I can't listen to voice notes yet.`;

export const VOICE_UNSUPPORTED =
  "I can't listen to voice notes yet. Please type the company name, or send a screenshot.";

export const IMAGE_ANALYSING = "🔍 Analysing your screenshot...";

export const IMAGE_NO_NAME =
  "I couldn't identify a company name from that image. Please type the company or platform name instead.";

export const GENERIC_ERROR =
  "Something went wrong. Please try again, or call SEC Ghana: 0800 100 065.";

export const DAILY_LIMIT =
  "You've reached today's check limit. Please try again tomorrow.\n\nIf this is urgent, call SEC Ghana: 0800 100 065.";

/** Shown once per sender, ahead of their first reply. */
export function welcomeBlock() {
  return `${WELCOME}\n\n---\n`;
}

/**
 * Build the reply from an API check response.
 *
 * Order is fixed: what it is → who said so → return check → warning signs →
 * what to ask → footer.
 */
export function buildReply(result, { query } = {}) {
  const report = result.report || {};
  const parts = [];

  /* 1. What this is ------------------------------------------------- */
  const icon = STATE_ICON[result.state] || "ℹ️";
  const name = result.entity ? `*${result.entity}*` : query ? `"${query}"` : "this";
  const sentence = report.state_sentence || `We checked ${name}.`;
  parts.push(`${icon} ${sentence}`);

  // The plain-English meaning of the evidence behind it.
  if (report.evidence_level?.meaning) {
    parts.push(`📊 *${report.evidence_level.label}*\n${report.evidence_level.meaning}`);
  }

  /* 2. Who published it --------------------------------------------- */
  if (report.sources?.length) {
    const lines = report.sources.slice(0, 3).map((s) => {
      const bits = [`📋 ${s.publisher}`];
      if (s.date) bits.push(`📅 ${s.date}`);
      if (s.url) bits.push(`🔗 ${s.url}`);
      return bits.join("\n");
    });
    parts.push(lines.join("\n\n"));
  }

  /* 3. Return promises ----------------------------------------------- */
  if (report.return_check) {
    const rc = report.return_check;
    parts.push(`📊 *Return check:* ${rc.stated}\n${rc.note}`);
  }

  /* 4. What was found ------------------------------------------------ */
  const signs = [...(report.warning_signs || []), ...(report.ai_warning_signs || [])];
  if (signs.length) {
    parts.push(["⚠️ *What we found:*", ...signs.slice(0, 6).map((s) => `• ${s}`)].join("\n"));
  }

  if (report.link_facts?.length) {
    parts.push(["🔗 *About the link:*", ...report.link_facts.slice(0, 5).map((f) => `• ${f}`)].join("\n"));
  }

  // Where a scheme borrows a real company's name, say whose.
  if (report.foreign_context?.length) {
    parts.push(["🌍 *Also found abroad:*", ...report.foreign_context.slice(0, 3).map((f) => `• ${f}`)].join("\n"));
  }

  if (report.notes?.length) {
    parts.push(report.notes.slice(0, 3).map((n) => `ℹ️ ${n}`).join("\n"));
  }

  /* 5. Questions to ask ---------------------------------------------- */
  if (report.questions_to_ask?.length) {
    const header =
      result.state === "licensed"
        ? "Even with licensed operators, good questions to ask:"
        : "Questions to ask before proceeding:";
    parts.push([header, ...report.questions_to_ask.map((q) => `• ${q}`)].join("\n"));
  }

  // Nothing on file: invite a report rather than leaving a dead end.
  if (result.state === "no_record") {
    parts.push(`You can help others by reporting what you know — reply *REPORT*.`);
  }

  /* 6. Footer --------------------------------------------------------- */
  if (report.disclaimer) parts.push(`_${report.disclaimer}_`);
  if (report.footer) parts.push(`ℹ️ ${report.footer}`);

  // Demo data must never be mistaken for a regulator's record.
  if (result.is_demo) parts.push("🧪 _Includes demo data — not a real institution's record._");

  return parts.filter(Boolean).join("\n\n");
}

/** "Did you mean?" — asked before judging a name that is close to a real one. */
export function buildDidYouMean(result) {
  const d = result.did_you_mean;
  if (!d) return null;

  return [
    "🤔 *Did you mean a different name?*",
    "",
    `You asked about *${d.original_query || "that name"}*.`,
    `There is a registered entity called *${d.suggested_entity}*.`,
    "",
    "Scammers often use a name that looks like a real one.",
    "",
    `Reply *1* for *${d.suggested_entity}*`,
    `Reply *2* to check *${d.original_query}* as you typed it`,
  ].join("\n");
}
