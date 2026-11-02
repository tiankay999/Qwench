// DEPRECATED — replaced by the evidence-based bot in src/core/.
//
// Superseded by the did-you-mean flow in src/core/handler.js.
// Nothing imports this any more. WhatsApp and Telegram both go through
// src/core/handler.js, which renders the report the API already builds.

import { verifyName } from "../api.js";
import {
  SPOOF_INVALID_CHOICE,
  formatBlacklistVariantAlert,
  formatLegitLookalike,
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

  if (v.decision === "spoofing_alert" || v.decision === "legit_lookalike") {
    session.draft = {
      spoofQuery: v.query,
      spoofMatch: v.match,
      spoofingDetection: v.spoofingDetection,
      injectedFlags: v.injectedFlags,
      // A registered entity to point the user at, whichever option they pick.
      legitMatch: v.matchIsLegit ? v.match : null,
    };
    setState(session, STATE.AWAITING_SPOOF_CHOICE);

    // A suspected impersonation and a plain name mix-up need different wording:
    // one is a warning, the other is just helping them find the real company.
    await send(v.decision === "spoofing_alert" ? formatSpoofConfirmation(v) : formatLegitLookalike(v));
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
    // Carry on, but remember the registered entity so the report can point at
    // it. Not for the "same entity" case -- there is nothing else to offer.
    return v.matchIsLegit && !v.isSameEntity ? { continueWith: { legitMatch: v.match } } : false;
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
    const legitMatch = draft.legitMatch;
    resetSession(session);
    return runCheck(ctx, draft.spoofQuery, {
      spoofingDetection: detection,
      injectedFlags: draft.injectedFlags || [],
      // Even when they check the look-alike, end by pointing at the real one.
      legitMatch,
      // They have already chosen; do not ask the same question again.
      skipConfirmation: true,
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
