// DEPRECATED — replaced by the evidence-based bot in src/core/.
//
// Superseded by src/core/handler.js.
// Nothing imports this any more. WhatsApp and Telegram both go through
// src/core/handler.js, which renders the report the API already builds.

import { checkInvestmentWithContext } from "../api.js";
import { API_ERROR, CHECKING, formatAuthorityCard, formatEvidenceSummary, formatRiskReport } from "../messages.js";
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
  const { spoofingDetection, injectedFlags, evidence, suppressEvidencePrompt, legitMatch, skipConfirmation } = opts;

  resetSession(session);
  await send(CHECKING(query));

  let result;
  try {
    result = await checkInvestmentWithContext(query, { spoofingDetection, injectedFlags, evidence, skipConfirmation });
  } catch (err) {
    console.error(`[check] failed for "${query}":`, err.response?.data?.error || err.message);
    return send(API_ERROR);
  }

  console.log(`[check] ${query} -> ${result.state} tier=${result.tier ?? "none"} (${(result.reason_codes || []).join(",") || "no codes"})`);

  // Regulators and government bodies are not investments, so they get an
  // information card instead of a risk verdict.
  if (result.state === "registered") {
    console.log(`[check] ${query} is an official body -- sending the authority card`);
    return send(formatAuthorityCard(result));
  }

  // No record at all. Rather than leave it at "I don't know", ask for
  // screenshots or a link so there is something to go on.
  const nothingKnown = !result.match && !result.tier;
  if (nothingKnown && !suppressEvidencePrompt) {
    const { startEvidenceCollection } = await import("./evidenceFlow.js");
    return startEvidenceCollection(ctx, result.entity || query);
  }

  const header = evidence?.evidenceCount
    ? formatEvidenceSummary({
        images: evidence.imageAnalyses?.length || 0,
        urls: evidence.urlAnalyses?.length || 0,
        texts: evidence.textEvidence?.length || 0,
      })
    : "";

  await send(formatRiskReport(result, { evidenceSummary: header, legitMatch }));
}
