import { getTrending } from "./api.js";
import { API_ERROR, CHECK_PROMPT, HELP, WELCOME, formatTrending } from "./messages.js";
import { runCheck } from "./flows/checkFlow.js";
import { handleSchemeName, handleSchemeSource, startReport } from "./flows/reportFlow.js";
import { STATE, getSession, resetSession, setState } from "./sessions.js";

/**
 * Decide what to do with one incoming text message.
 * ctx = { jid, phone, send(text) }
 */
export async function routeMessage(ctx, rawText) {
  const text = String(rawText || "").trim();
  if (!text) return;

  const session = getSession(ctx.jid);
  const fullCtx = { ...ctx, session };
  const command = text.toLowerCase();

  console.log(`[router] ${ctx.phone} [${session.state}] "${text}"`);

  /* --- Mid-flow states take priority over keyword matching -------- */
  if (session.state === STATE.AWAITING_SCHEME_NAME) {
    return handleSchemeName(fullCtx, text);
  }

  if (session.state === STATE.AWAITING_SCHEME_SOURCE) {
    return handleSchemeSource(fullCtx, text);
  }

  if (session.state === STATE.AWAITING_CHECK_QUERY) {
    return runCheck(fullCtx, text);
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
  // "check menzgold" / "verify GhanaCoin" -> strip the verb, check the rest
  const stripped = text.replace(/^(check|verify|scan|is)\s+/i, "").trim();
  return runCheck(fullCtx, stripped || text);
}

function isGreeting(command) {
  return /^(hi+|hello|hey+|start|menu|good (morning|afternoon|evening))$/i.test(command);
}
