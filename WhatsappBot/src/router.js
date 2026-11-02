import { CHECK_PROMPT, HELP, WELCOME } from "./messages.js";
import { runCheck } from "./flows/checkFlow.js";
import { handleSchemeName, startReport } from "./flows/reportFlow.js";
import { STATE, getSession, resetSession, setState, stateExpired } from "./sessions.js";

/**
 * Decide what to do with one incoming message. Nothing about it is logged.
 * ctx = { jid, send(text) }
 * media = { base64, mimeType } when the user sent an image
 */
export async function routeMessage(ctx, rawText, media = null) {
  const text = String(rawText || "").trim();
  if (!text && !media) return;

  const session = getSession(ctx.jid);
  const fullCtx = { ...ctx, session };
  const command = text.toLowerCase();

  // A flow the user abandoned should not capture their next question.
  if (stateExpired(session)) resetSession(session);

  /* --- Mid-flow states take priority over keyword matching -------- */
  if (session.state === STATE.AWAITING_SUGGESTION_REPLY) {
    const suggestion = session.draft.suggestion;
    resetSession(session);
    if (/^(yes|y|1)$/i.test(command)) return runCheck(fullCtx, suggestion);
    // Anything else is a new message, handled below.
  }

  if (session.state === STATE.AWAITING_SCHEME_NAME && text) {
    return handleSchemeName(fullCtx, text);
  }

  if (session.state === STATE.AWAITING_CHECK_QUERY) {
    return runCheck(fullCtx, text, media);
  }

  /* --- First-time user gets the welcome message ------------------- */
  if (session.isNew) {
    session.isNew = false;
    await ctx.send(WELCOME);

    // They may have opened with a real message rather than a greeting -- fall
    // through so it still gets handled, but do not send the welcome twice.
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

  /* --- Anything else is treated as something to check ------------- */
  // "check menzgold" / "verify Expert Option" -> strip the verb, check the rest
  const stripped = text.replace(/^(check|verify|scan|is)\s+/i, "").trim();
  return runCheck(fullCtx, stripped || text, media);
}

function isGreeting(command) {
  return /^(hi+|hello|hey+|start|menu|good (morning|afternoon|evening))$/i.test(command);
}
