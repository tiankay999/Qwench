// DEPRECATED — replaced by the evidence-based bot in src/core/.
//
// Superseded by the report flow in src/core/handler.js.
// Nothing imports this any more. WhatsApp and Telegram both go through
// src/core/handler.js, which renders the report the API already builds.

import { submitReport } from "../api.js";
import {
  API_ERROR,
  INVALID_SOURCE,
  REPORT_ASK_NAME,
  REPORT_ASK_SOURCE,
  REPORT_CANCELLED,
  REPORT_CONFIRMED,
} from "../messages.js";
import { STATE, resetSession, setState } from "../sessions.js";

const SOURCES = {
  1: "whatsapp",
  2: "social-media",
  3: "friend",
  4: "other",
};

/** Step 1 -- user typed "report" */
export async function startReport(ctx) {
  const { send, session } = ctx;
  session.draft = {};
  setState(session, STATE.AWAITING_SCHEME_NAME);
  await send(REPORT_ASK_NAME);
}

/** Step 2 -- user sent the scheme name */
export async function handleSchemeName(ctx, text) {
  const { send, session } = ctx;

  if (/^cancel$/i.test(text)) {
    resetSession(session);
    return send(REPORT_CANCELLED);
  }

  session.draft.schemeName = text.trim();
  console.log(`[report] scheme name captured: "${session.draft.schemeName}"`);
  setState(session, STATE.AWAITING_SCHEME_SOURCE);
  await send(REPORT_ASK_SOURCE);
}

/** Step 3 -- user picked how they heard about it, then we save it */
export async function handleSchemeSource(ctx, text) {
  const { send, session, phone } = ctx;

  if (/^cancel$/i.test(text)) {
    resetSession(session);
    return send(REPORT_CANCELLED);
  }

  const choice = text.trim().match(/^[1-4]$/)?.[0];
  if (!choice) {
    console.log(`[report] invalid source choice: "${text}"`);
    return send(INVALID_SOURCE);
  }

  const payload = {
    schemeName: session.draft.schemeName,
    source: SOURCES[choice],
    schemeType: "other",
    reporterPhone: phone,
  };

  try {
    const saved = await submitReport(payload);
    console.log(`[report] saved "${payload.schemeName}" (${saved.totalReportsForScheme} total for this scheme)`);
    resetSession(session);

    let msg = REPORT_CONFIRMED;
    if (saved.totalReportsForScheme > 1) {
      msg += `\n\n👥 ${saved.totalReportsForScheme} people have now reported *${saved.schemeName}*.`;
    }
    await send(msg);
  } catch (err) {
    console.error(`[report] failed to save:`, err.response?.data?.error || err.message);
    resetSession(session);
    await send(API_ERROR);
  }
}
