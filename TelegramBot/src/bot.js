import { API_DOWN, DAILY_LIMIT, HELP, REPORT_USAGE, WELCOME, formatReply, splitMessage } from "./format.js";

/** Calls the Qwench API. The sender is a reference only: the API hashes it straight away. */
export function qwenchClient({ baseUrl, channelKey, fetch: send = fetch }) {
  const call = async (path, body) => {
    const res = await send(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-channel-key": channelKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  return {
    check: (input, sender) => call("/v1/public/check", { ...input, channel: "telegram", sender_ref: sender }),
    report: (schemeName, sender) => call("/v1/public/reports", { scheme_name: schemeName, channel: "telegram", sender_ref: sender }),
  };
}

const MAX_TEXT = 5000;
const senderRef = (message) => `telegram:${message.from?.id ?? message.chat.id}`;

/** What to say back to one message. Returns the replies, and keeps nothing. */
export async function handleMessage(message, { qwench, downloadPhoto }) {
  const text = (message.text || message.caption || "").trim();
  const sender = senderRef(message);
  const command = text.match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/);

  if (command) {
    const [, name, rest] = command;
    if (name === "start") return [WELCOME];
    if (name === "help") return [HELP];
    if (name === "report") {
      if (!rest.trim()) return [REPORT_USAGE];
      const { status, body } = await qwench.report(rest.trim().slice(0, 200), sender);
      if (status === 429) return [DAILY_LIMIT];
      return [status === 202 ? body.message : API_DOWN];
    }
  }

  const input = {};
  if (text && !command) input.text = text.slice(0, MAX_TEXT);

  const photo = message.photo?.at(-1);
  if (photo) {
    const image = await downloadPhoto(photo.file_id).catch(() => null);
    if (image) {
      input.image_base64 = image.base64;
      input.mime_type = image.mimeType;
    }
  }
  if (!input.text && !input.image_base64) return [WELCOME];

  const { status, body } = await qwench.check(input, sender);
  if (status === 429) return [DAILY_LIMIT];
  if (status !== 200 || !body.report) return [API_DOWN];
  return splitMessage(formatReply(body));
}
