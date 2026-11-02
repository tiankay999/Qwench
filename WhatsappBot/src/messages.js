/**
 * Everything the bot says. Every word about a finding comes from the API, in the
 * order docs/API.md sets: no score, verdict or colour is added here.
 */

export const WELCOME = `🛡️ Welcome to Qwench.

Send me an offer you've received: the message, a link, a number, a name or a screenshot. I'll show you what Qwench could find, and how much evidence there is.

Or type:
• report — Report a scheme for a person to review
• help — How Qwench works

What you send is used to run the check. Qwench doesn't keep your message or who sent it. Screenshots and linked pages may be read by an AI provider.`;

export const HELP = `🛡️ *How Qwench works*

Qwench checks what you send against reviewed regulator notices, and looks for warning signs in the message and any links.

You get an evidence level, from "Regulator warning" to "Not enough to go on". It tells you how much evidence there is. It isn't a verdict, and it isn't advice.

*Commands*
• check — Check an offer
• report — Report a scheme for a person to review
• help — This message`;

export const CHECK_PROMPT = `🔍 What would you like me to check?

Send the message, a link, a number, a name or a screenshot.`;

export const REPORT_ASK_NAME = `📢 *Report a scheme*

What is the name of the scheme or company?

_Type "cancel" to stop._`;

export const REPORT_CANCELLED = `No problem — report cancelled.`;

export const CHECKING = `🔍 Checking that now...`;

export const API_ERROR = `⚠️ I couldn't reach Qwench just now. Please try again in a moment.`;

export const DAILY_LIMIT = `You've reached today's limit of checks. Please try again tomorrow.`;

const section = (title, lines) =>
  lines?.length ? `*${title}*\n${lines.map((line) => `• ${line}`).join("\n")}` : "";

/** Build the WhatsApp reply from a /v1/public/check result. */
export function formatReply(reply) {
  const { report, did_you_mean: suggestion } = reply;
  const parts = [
    reply.is_demo ? "*DEMO DATA*" : "",
    `🛡️ *${report.evidence_level.label}*`,
    report.evidence_level.meaning,
    report.state_sentence,
    ...report.foreign_context,
    section("Sources", report.sources.map((s) => [s.publisher, s.date, s.url].filter(Boolean).join(", "))),
    section("Also checked", report.also_checked),
    report.return_check?.note ? `*Stated return:* ${report.return_check.stated}. ${report.return_check.note}` : "",
    section("Warning signs", report.warning_signs),
    section("Spotted by AI", report.ai_warning_signs),
    section("About the link", report.link_facts),
    section("Questions to ask", report.questions_to_ask),
    ...report.notes,
    `_${report.disclaimer}_`,
    `_${report.footer}_`,
    suggestion?.suggested_entity ? `Did you mean *${suggestion.suggested_entity}*? Reply *yes* to check that name.` : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}
