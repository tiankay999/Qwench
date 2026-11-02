// DEPRECATED — replaced by the evidence-based bot in src/core/.
//
// The old command router, built around AI risk scores.
// Nothing imports this any more. WhatsApp and Telegram both go through
// src/core/handler.js, which renders the report the API already builds.

import { getTrending } from "./api.js";
import { API_ERROR, CHECK_PROMPT, HELP, WELCOME, formatTrending } from "./messages.js";
import { runCheck } from "./flows/checkFlow.js";
import { handleEvidence } from "./flows/evidenceFlow.js";
import { handleSchemeName, handleSchemeSource, startReport } from "./flows/reportFlow.js";
import { handleSpoofChoice, verifyBeforeCheck } from "./flows/verifyFlow.js";
import { STATE, getSession, resetSession, setState, stateExpired } from "./sessions.js";

/**
 * Decide what to do with one incoming message.
 * ctx = { jid, phone, send(text) }
 * media = { base64, mimeType } when the user sent an image
 */
export async function routeMessage(ctx, rawText, media = null) {
  const text = String(rawText || "").trim();
  if (!text && !media) return;

  const session = getSession(ctx.jid);
  const fullCtx = { ...ctx, session };
  const command = text.toLowerCase();

  console.log(`[router] ${ctx.phone} [${session.state}] "${text}"${media ? " +image" : ""}`);

  // A flow the user abandoned should not capture their next question.
  if (stateExpired(session)) resetSession(session);

  /* --- Evidence collection takes priority: it is the only state that
         accepts images ------------------------------------------------ */
  if (session.state === STATE.AWAITING_EVIDENCE) {
    return handleEvidence(fullCtx, text, media);
  }

  // Outside the evidence flow an image has no meaning, so say so rather than
  // silently dropping it.
  if (media && !text) {
    return ctx.send(
      "📸 Thanks, but I need to know what to check first.\n\nSend me a company name, token or link, and if I can't verify it I'll ask you for screenshots."
    );
  }

  /* --- Mid-flow states take priority over keyword matching -------- */
  if (session.state === STATE.AWAITING_SPOOF_CHOICE) {
    const handled = await handleSpoofChoice(fullCtx, text);
    // null means "not a menu choice" -- fall through and treat it as a new query.
    if (handled !== null) return handled;
  }

  if (session.state === STATE.AWAITING_SCHEME_NAME) {
    return handleSchemeName(fullCtx, text);
  }

  if (session.state === STATE.AWAITING_SCHEME_SOURCE) {
    return handleSchemeSource(fullCtx, text);
  }

  if (session.state === STATE.AWAITING_CHECK_QUERY) {
    return checkWithVerification(fullCtx, text);
  }

  /* --- First-time user gets the welcome message ------------------- */
  if (session.isNew) {
    session.isNew = false;
    console.log(`[router] new user ${ctx.phone} -- sending welcome`);
    await ctx.send(WELCOME);

    // They may have opened with a real query ("Menzgold") rather than a
    // greeting -- fall through so it still gets handled, but do not send the
    // welcome twice if a greeting is all they sent.
    if (isGreeting(command)) return;
  }

  /* --- Commands --------------------------------------------------- */
  if (isGreeting(command)) {
    resetSession(session);
    return ctx.send(WELCOME);
  }

  if (/^(help|info|how|how it works)$/i.test(command)) {
    resetSession(session);
    return ctx.send(HELP);
  }

  if (/^(check|verify|scan)$/i.test(command)) {
    setState(session, STATE.AWAITING_CHECK_QUERY);
    return ctx.send(CHECK_PROMPT);
  }

  if (/^(report|flag)$/i.test(command)) {
    return startReport(fullCtx);
  }

  if (/^(trending|top|popular)$/i.test(command)) {
    resetSession(session);
    try {
      const items = await getTrending(5);
      return ctx.send(formatTrending(items));
    } catch (err) {
      console.error("[router] trending failed:", err.message);
      return ctx.send(API_ERROR);
    }
  }

  /* --- Anything else is treated as something to check ------------- */
  // "check menzgold" / "verify Expert Option" -> strip the verb, check the rest
  const stripped = text.replace(/^(check|verify|scan|is)\s+/i, "").trim();
  return checkWithVerification(fullCtx, stripped || text);
}

/**
 * Name verification first, then the risk check.
 * Verification may take over the conversation (to ask which name was meant),
 * in which case it has already replied.
 */
async function checkWithVerification(ctx, query) {
  const outcome = await verifyBeforeCheck(ctx, query);

  // true = verification is handling the conversation (it asked a question).
  if (outcome === true) return;

  // An object means "carry on, but with this extra context" -- currently a
  // registered entity to point at once the report is ready.
  return runCheck(ctx, query, outcome?.continueWith || {});
}

function isGreeting(command) {
  return /^(hi+|hello|hey+|start|menu|good (morning|afternoon|evening))$/i.test(command);
}
