// DEPRECATED — replaced by the evidence-based bot in src/core/.
//
// Superseded: the API accepts images and links directly.
// Nothing imports this any more. WhatsApp and Telegram both go through
// src/core/handler.js, which renders the report the API already builds.

import { analyzeImageEvidence, analyzeUrlEvidence } from "../api.js";
import {
  API_ERROR,
  EVIDENCE_ANALYZING,
  EVIDENCE_CANCELLED,
  EVIDENCE_IMAGE_FAILED,
  EVIDENCE_NONE_YET,
  EVIDENCE_NOTE_SAVED,
  formatEvidenceReceived,
  formatNeedMoreInfo,
} from "../messages.js";
import { STATE, resetSession, setState } from "../sessions.js";
import { extractUrls, runCheck } from "./checkFlow.js";

const MAX_EVIDENCE = 5;

/** Ask the user for screenshots / links after an inconclusive check. */
export async function startEvidenceCollection(ctx, entityName) {
  const { send, session } = ctx;

  session.draft = { evidenceQuery: entityName, evidenceCollected: [] };
  setState(session, STATE.AWAITING_EVIDENCE);
  console.log(`[evidence] asking ${ctx.phone} for evidence about "${entityName}"`);

  await send(formatNeedMoreInfo(entityName));
}

/**
 * Report already sent, but nothing corroborated it. Offer to take evidence so
 * a name-only judgement can be replaced with a grounded one.
 */
export async function offerEvidenceRefinement(ctx, entityName, notice) {
  const { send, session } = ctx;

  session.draft = { evidenceQuery: entityName, evidenceCollected: [] };
  setState(session, STATE.AWAITING_EVIDENCE);
  console.log(`[evidence] offering refinement for "${entityName}" to ${ctx.phone}`);

  await send(
    [
      "ℹ️ *That verdict is based on the name alone.*",
      "",
      notice || `I have no SEC Ghana record, market data or community report for "${entityName}".`,
      "",
      "📎 *Want a proper check?* Send me:",
      "1️⃣ 📸 a screenshot of their website, app or WhatsApp group",
      "2️⃣ 🔗 their website or social media link",
      "3️⃣ 💬 any promotional message they sent you",
      "",
      "_Or type *skip* if you're done._",
    ].join("\n")
  );
}

/**
 * Handles anything the user sends while we are collecting evidence:
 * an image, a link, free text, or "done" / "skip".
 */
export async function handleEvidence(ctx, text, media) {
  const { send, session } = ctx;
  const draft = session.draft || {};
  const collected = draft.evidenceCollected || [];
  const entityName = draft.evidenceQuery || "";

  /* --- Images ----------------------------------------------------- */
  if (media?.tooLarge) {
    return send(
      `⚠️ That image is ${(media.bytes / 1_048_576).toFixed(1)}MB, too large for me to read.\n\nSend a smaller screenshot, a link instead, or type *done*.`
    );
  }

  if (media?.base64) {
    await send(EVIDENCE_ANALYZING);

    let analysis;
    try {
      analysis = await analyzeImageEvidence(media.base64, media.mimeType, entityName);
    } catch (err) {
      console.error(`[evidence] image analysis failed: ${err.response?.data?.error || err.message}`);
      return send(EVIDENCE_IMAGE_FAILED);
    }

    if (!analysis || analysis.error) {
      return send(analysis?.summary ? `⚠️ ${analysis.summary}` : EVIDENCE_IMAGE_FAILED);
    }

    collected.push({ type: "image", analysis, timestamp: Date.now() });
    draft.evidenceCollected = collected;

    await send(formatEvidenceReceived({ kind: "image", analysis, count: collected.length, max: MAX_EVIDENCE }));
    if (collected.length >= MAX_EVIDENCE) return finalize(ctx);
    return;
  }

  const body = String(text || "").trim();
  const command = body.toLowerCase();

  /* --- Finish / abandon ------------------------------------------- */
  if (/^(done|thats all|that's all|finish|finished|go|report)$/i.test(command)) {
    if (!collected.length) return send(EVIDENCE_NONE_YET);
    return finalize(ctx);
  }

  if (/^(skip|no|none)$/i.test(command)) {
    console.log(`[evidence] ${ctx.phone} skipped evidence for "${entityName}"`);
    if (!collected.length) {
      // Nothing to re-analyze and they already have the report: just stop.
      resetSession(session);
      return send(EVIDENCE_CANCELLED);
    }
    return finalize(ctx, { skipped: true });
  }

  if (/^(cancel|stop)$/i.test(command)) {
    resetSession(session);
    return send(EVIDENCE_CANCELLED);
  }

  /* --- Links ------------------------------------------------------- */
  const urls = extractUrls(body);
  if (urls.length) {
    await send(EVIDENCE_ANALYZING);

    for (const url of urls.slice(0, MAX_EVIDENCE - collected.length)) {
      let analysis;
      try {
        analysis = await analyzeUrlEvidence(url, entityName);
      } catch (err) {
        console.error(`[evidence] url analysis failed for ${url}: ${err.response?.data?.error || err.message}`);
        await send(`⚠️ I couldn't analyze ${url}. Send another link, a screenshot, or type *done*.`);
        continue;
      }

      collected.push({ type: "url", url, analysis, timestamp: Date.now() });
      draft.evidenceCollected = collected;
      await send(formatEvidenceReceived({ kind: "url", analysis, count: collected.length, max: MAX_EVIDENCE }));
    }

    if (collected.length >= MAX_EVIDENCE) return finalize(ctx);
    return;
  }

  /* --- Plain text becomes extra context --------------------------- */
  if (body) {
    collected.push({ type: "text", content: body.slice(0, 1000), timestamp: Date.now() });
    draft.evidenceCollected = collected;
    console.log(`[evidence] noted text from ${ctx.phone} (${collected.length}/${MAX_EVIDENCE})`);

    if (collected.length >= MAX_EVIDENCE) return finalize(ctx);
    return send(EVIDENCE_NOTE_SAVED);
  }
}

/** Bundle everything collected and run the final evidence-based analysis. */
async function finalize(ctx, { skipped = false } = {}) {
  const { send, session } = ctx;
  const draft = session.draft || {};
  const collected = draft.evidenceCollected || [];
  const entityName = draft.evidenceQuery || "";

  const bundle = {
    originalQuery: entityName,
    evidenceCount: collected.length,
    imageAnalyses: collected.filter((e) => e.type === "image").map((e) => e.analysis),
    urlAnalyses: collected.filter((e) => e.type === "url").map((e) => ({ url: e.url, ...e.analysis })),
    textEvidence: collected.filter((e) => e.type === "text").map((e) => e.content),
  };

  console.log(
    `[evidence] finalizing "${entityName}" with ${bundle.evidenceCount} item(s) ` +
      `(${bundle.imageAnalyses.length} image, ${bundle.urlAnalyses.length} url, ${bundle.textEvidence.length} text)`
  );

  resetSession(session);

  if (skipped && !collected.length) {
    // Nothing supplied: give the verdict we already had, without re-asking.
    return runCheck(ctx, entityName, { suppressEvidencePrompt: true });
  }

  try {
    await runCheck(ctx, entityName, { evidence: bundle, suppressEvidencePrompt: true });
  } catch (err) {
    console.error(`[evidence] final analysis failed: ${err.message}`);
    await send(API_ERROR);
  }
}
