/**
 * Turns the API's report into a Telegram message. Every word about a finding comes from
 * the API, in the order docs/API.md sets. Sent as plain text, so nothing in a report or
 * a user's message can be read as formatting or a link trick.
 */

const MAX_MESSAGE = 4000;

export const WELCOME = `Welcome to Qwench.

Send me an offer you've received: the message, a link, a number, a name or a screenshot. I'll show you what Qwench could find, and how much evidence there is.

Commands:
/report Name of the scheme - report something for a person to review
/help - how this works

What you send is used to run the check. Qwench doesn't keep your message or who sent it. Screenshots and linked pages may be read by an AI provider.`;

export const HELP = `Qwench checks what you send against reviewed regulator notices, and looks for warning signs in the message and any links.

You get an evidence level, from "Regulator warning" to "Not enough to go on". It tells you how much evidence there is. It isn't a verdict, and it isn't advice.

To report something: /report Name of the scheme`;

export const REPORT_USAGE = "Add the scheme's name, like this: /report Name of the scheme";
export const API_DOWN = "I can't reach Qwench right now. Please try again in a moment.";
export const DAILY_LIMIT = "You've reached today's limit of checks. Please try again tomorrow.";

const section = (title, lines) => (lines?.length ? `${title}\n${lines.map((line) => `- ${line}`).join("\n")}` : "");

export function formatReply(reply) {
  const { report } = reply;
  const parts = [
    reply.is_demo ? "DEMO DATA" : "",
    report.evidence_level.label,
    report.evidence_level.meaning,
    report.state_sentence,
    ...report.foreign_context,
    section("Sources", report.sources.map((s) => [s.publisher, s.date, s.url].filter(Boolean).join(", "))),
    section("Also checked", report.also_checked),
    report.return_check?.note ? `Stated return: ${report.return_check.stated}. ${report.return_check.note}` : "",
    section("Warning signs", report.warning_signs),
    section("Spotted by AI", report.ai_warning_signs),
    section("About the link", report.link_facts),
    // Published guidance from a Ghana authority, attributed and linked. Their
    // words about how the real service works, not a finding about this message.
    ...(report.advisories || []).map((a) =>
      section(`${a.topic}\n(${[a.publisher, a.date].filter(Boolean).join(", ")})`, [...a.points, a.url]),
    ),
    section("Questions to ask", report.questions_to_ask),
    ...report.notes,
    report.disclaimer,
    report.footer,
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** Telegram refuses long messages, so split between paragraphs. */
export function splitMessage(text, limit = MAX_MESSAGE) {
  const chunks = [];
  let current = "";
  for (const paragraph of text.split("\n\n")) {
    const piece = paragraph.length > limit ? paragraph.slice(0, limit) : paragraph;
    if (current && current.length + piece.length + 2 > limit) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
