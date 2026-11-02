import { handleMessage, qwenchClient } from "./bot.js";
import { API_DOWN } from "./format.js";

const { TELEGRAM_BOT_TOKEN: token, CHANNEL_API_KEY: channelKey, API_BASE_URL: baseUrl = "http://localhost:4000" } = process.env;

if (!token || !channelKey) {
  console.error("Set TELEGRAM_BOT_TOKEN and CHANNEL_API_KEY. See .env.example.");
  process.exit(1);
}

const telegram = async (method, body) => {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(70_000),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram refused ${method}`);
  return data.result;
};

async function downloadPhoto(fileId) {
  const file = await telegram("getFile", { file_id: fileId });
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  return { base64: bytes.toString("base64"), mimeType: file.file_path.endsWith(".png") ? "image/png" : "image/jpeg" };
}

const qwench = qwenchClient({ baseUrl, channelKey });
let offset = 0;

console.log("Qwench Telegram bot is running");

for (;;) {
  try {
    const updates = await telegram("getUpdates", { timeout: 50, offset, allowed_updates: ["message"] });
    for (const update of updates) {
      offset = update.update_id + 1;
      if (!update.message) continue;
      const chatId = update.message.chat.id;
      // Nothing about the message or sender is logged.
      const replies = await handleMessage(update.message, { qwench, downloadPhoto }).catch(() => [API_DOWN]);
      for (const text of replies) await telegram("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
    }
  } catch (err) {
    console.error(`Polling problem: ${err.name}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
