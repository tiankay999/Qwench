import { checkInvestmentWithContext } from "../api.js";
import { API_ERROR, CHECKING, formatEvidenceSummary, formatRiskReport } from "../messages.js";
import { resetSession } from "../sessions.js";

/** Pull http(s) links out of a message. */
export function extractUrls(text) {
  return String(text || "").match(/https?:\/\/[^\s<>"')]+/gi) || [];
}

/**
 * Run a risk check and send the formatted report back.
 * This is the main feature of the bot.
 *
 * opts:
 *   spoofingDetection       - name-verification payload to pass to the analyzer
 *   injectedFlags           - flags established before the analysis ran
 *   evidence                - bundle of user-supplied screenshots / links / text
 *   suppressEvidencePrompt  - do not ask for evidence again (we already did)
 */
export async function runCheck(ctx, query, opts = {}) {
  const { send, session } = ctx;
  const { spoofingDetection, injectedFlags, evidence, suppressEvidencePrompt } = opts;

  resetSession(session);
  await send(CHECKING(query));

  let result;
  try {
    result = await checkInvestmentWithContext(query, { spoofingDetection, injectedFlags, evidence });
  } catch (err) {
    console.error(`[check] failed for "${query}":`, err.response?.data?.error || err.message);
    return send(API_ERROR);
  }

  const engineTag = result.analyzedBy === "ai" ? "🤖 AI (LLM)" : "📋 Rule-based";
  console.log(`[check] ${query} -> ${result.riskScore}/10 ${result.riskLevel} (${engineTag})`);

  // Nothing known about this entity and the score is a shrug -- ask the user
  // for proof instead of handing them a vague MEDIUM.
  if (result.needsMoreInfo && !suppressEvidencePrompt) {
    const { startEvidenceCollection } = await import("./evidenceFlow.js");
    return startEvidenceCollection(ctx, result.name || query);
  }

  const header = evidence?.evidenceCount
    ? formatEvidenceSummary({
        images: evidence.imageAnalyses?.length || 0,
        urls: evidence.urlAnalyses?.length || 0,
        texts: evidence.textEvidence?.length || 0,
      })
    : "";

  await send(formatRiskReport(result, { evidenceSummary: header }));

  // Nothing corroborated this verdict, so give the user the report and then
  // offer to improve it rather than leaving a name-only judgement to stand.
  if (result.canRefineWithEvidence && !suppressEvidencePrompt) {
    const { offerEvidenceRefinement } = await import("./evidenceFlow.js");
    await offerEvidenceRefinement(ctx, result.name || query, result.noDataNotice);
  }
}
