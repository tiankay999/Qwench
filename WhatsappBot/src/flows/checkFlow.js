import { checkInvestment } from "../api.js";
import { API_ERROR, CHECKING, formatRiskReport } from "../messages.js";
import { resetSession } from "../sessions.js";

/**
 * Run a risk check and send the formatted report back.
 * This is the main feature of the bot.
 */
export async function runCheck(ctx, query) {
  const { send, session } = ctx;
  resetSession(session);

  await send(CHECKING(query));

  try {
    const result = await checkInvestment(query);
    const engineTag = result.analyzedBy === "ai" ? "🤖 AI (LLM)" : "📋 Rule-based";
    console.log(`[check] ${query} -> ${result.riskScore}/10 ${result.riskLevel} (${engineTag})`);
    await send(formatRiskReport(result));
  } catch (err) {
    console.error(`[check] failed for "${query}":`, err.response?.data?.error || err.message);
    await send(API_ERROR);
  }
}
