import { checkMessage } from "../api.js";
import { API_ERROR, CHECKING, DAILY_LIMIT, formatReply } from "../messages.js";
import { STATE, resetSession, setState } from "../sessions.js";

const MAX_TEXT = 5000;

/** Send one message or screenshot to the API, and send back its report. */
export async function runCheck(ctx, text, media = null) {
  const { send, session, jid } = ctx;

  resetSession(session);
  await send(CHECKING);

  const input = {};
  if (text) input.text = text.slice(0, MAX_TEXT);
  if (media) {
    input.image_base64 = media.base64;
    input.mime_type = media.mimeType;
  }

  let reply;
  try {
    reply = await checkMessage(input, `whatsapp:${jid}`);
  } catch (err) {
    // The status only: nothing about the message or sender goes in the logs.
    console.error(`[check] failed: ${err.response?.status || err.code || "no response"}`);
    return send(err.response?.status === 429 ? DAILY_LIMIT : API_ERROR);
  }

  if (reply.did_you_mean?.suggested_entity) {
    session.draft = { suggestion: reply.did_you_mean.suggested_entity };
    setState(session, STATE.AWAITING_SUGGESTION_REPLY);
  }

  await send(formatReply(reply));
}
