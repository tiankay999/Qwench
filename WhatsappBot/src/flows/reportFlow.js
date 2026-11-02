import { submitReport } from "../api.js";
import { API_ERROR, DAILY_LIMIT, REPORT_ASK_NAME, REPORT_CANCELLED } from "../messages.js";
import { STATE, resetSession, setState } from "../sessions.js";

const MAX_NAME = 200;

/** Step 1 -- user typed "report" */
export async function startReport(ctx) {
  const { send, session } = ctx;
  setState(session, STATE.AWAITING_SCHEME_NAME);
  await send(REPORT_ASK_NAME);
}

/** Step 2 -- user sent the scheme name. The reply is the API's, with no count. */
export async function handleSchemeName(ctx, text) {
  const { send, session, jid } = ctx;
  resetSession(session);

  if (/^cancel$/i.test(text)) return send(REPORT_CANCELLED);

  try {
    const saved = await submitReport(text.trim().slice(0, MAX_NAME), `whatsapp:${jid}`);
    await send(saved.message);
  } catch (err) {
    console.error(`[report] failed: ${err.response?.status || err.code || "no response"}`);
    await send(err.response?.status === 429 ? DAILY_LIMIT : API_ERROR);
  }
}
