import { verifyName } from "../api.js";
import {
  SPOOF_INVALID_CHOICE,
  formatBlacklistVariantAlert,
  formatSoftWarning,
  formatSpoofConfirmation,
} from "../messages.js";
import { STATE, resetSession, setState } from "../sessions.js";
import { runCheck } from "./checkFlow.js";

/**
 * Name verification runs before every risk check.
 *
 * Returns true when it has taken over the conversation (asked the user to
 * confirm which name they meant), false when the caller should carry on.
 */
export async function verifyBeforeCheck(ctx, query) {
  const { send, session } = ctx;

  let v;
  try {
    v = await verifyName(query);
  } catch (err) {
    // Verification is an enhancement, never a gate. If it fails, check anyway.
    console.warn(`[verify] lookup failed for "${query}": ${err.response?.data?.error || err.message}`);
    return false;
  }

  if (v.decision === "spoofing_alert") {
    session.draft = {
      spoofQuery: v.query,
      spoofMatch: v.match,
      spoofingDetection: v.spoofingDetection,
      injectedFlags: v.injectedFlags,
    };
    setState(session, STATE.AWAITING_SPOOF_CHOICE);
    await send(formatSpoofConfirmation(v));
    return true;
  }

  if (v.decision === "blacklist_variant") {
    // No choice to offer: a dressed-up blacklisted name is that same scheme.
    await send(formatBlacklistVariantAlert(v));
    await runCheck(ctx, v.query, {
      spoofingDetection: v.spoofingDetection,
      injectedFlags: v.injectedFlags,
    });
    return true;
  }

  if (v.decision === "soft_warning") {
    await send(formatSoftWarning(v));
    return false; // carry on with the normal check
  }

  return false;
}

/** Handles the "1 or 2" reply to a spoofing confirmation. */
export async function handleSpoofChoice(ctx, text) {
  const { send, session } = ctx;
  const draft = session.draft || {};
  const choice = text.trim();

  if (/^(cancel|stop|no)$/i.test(choice)) {
    resetSession(session);
    return send("No problem — cancelled. Send any name whenever you want a check.");
  }

  if (choice === "1") {
    const name = draft.spoofMatch?.name;
    console.log(`[verify] user chose the registered entity: ${name}`);
    resetSession(session);
    // The real entity: a clean check with no impersonation flags attached.
    return runCheck(ctx, name);
  }

  if (choice === "2") {
    console.log(`[verify] user chose to investigate "${draft.spoofQuery}" separately`);
    const detection = draft.spoofingDetection
      ? { ...draft.spoofingDetection, userChoice: "investigate_separately" }
      : null;
    resetSession(session);
    return runCheck(ctx, draft.spoofQuery, {
      spoofingDetection: detection,
      injectedFlags: draft.injectedFlags || [],
    });
  }

  // Not 1 or 2. If it looks like a fresh company name, treat it as one.
  if (choice.length > 3 && !/^\d+$/.test(choice)) {
    console.log(`[verify] "${choice}" is not a menu choice -- treating as a new query`);
    resetSession(session);
    return null; // signals the router to re-route this message
  }

  return send(SPOOF_INVALID_CHOICE);
}
