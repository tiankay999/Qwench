import { Telegraf } from "telegraf";

import { handleMessage } from "./core/handler.js";
import { GENERIC_ERROR, HELP } from "./core/reply.js";

/**
 * Telegram channel.
 *
 * A thin adapter: it turns a Telegram update into the same { text, image,
 * voice } shape the WhatsApp side produces, and hands it to the shared
 * handler. All the wording and flow logic lives there, so the two channels
 * cannot drift apart.
 */

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function makeCtx(tgCtx) {
  return {
    channel: "telegram",
    // Telegram's numeric chat id. The API hashes it with a daily salt for the
    // fair-use count; nothing links a person to what they checked.
    senderId: `tg:${tgCtx.chat.id}`,
    send: async (text) => {
      // Sent as plain text on purpose: the reply contains names and URLs that
      // Telegram's Markdown parser would reject or mangle.
      await tgCtx.reply(text, { disable_web_page_preview: true });
      console.log(`[tg] 📤 to ${tgCtx.chat.id}: ${text.split("\n")[0].slice(0, 60)}...`);
    },
    sendTyping: () => tgCtx.sendChatAction("typing").catch(() => {}),
  };
}

/** Pull the largest version of a photo down as base64. */
async function downloadPhoto(tgCtx, token) {
  const photos = tgCtx.message.photo || [];
  const largest = photos[photos.length - 1];
  if (!largest) return null;

  if (largest.file_size && largest.file_size > MAX_IMAGE_BYTES) {
    return { tooLarge: true, bytes: largest.file_size };
  }

  const file = await tgCtx.telegram.getFile(largest.file_id);
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!res.ok) throw new Error(`file download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) return { tooLarge: true, bytes: buffer.length };

  return { base64: buffer.toString("base64"), mimeType: "image/jpeg", bytes: buffer.length };
}

export function startTelegramBot() {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();

  if (!token) {
    console.log("[tg] TELEGRAM_BOT_TOKEN not set — Telegram channel disabled");
    return null;
  }

  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    console.log(`[tg] 📩 /start from ${ctx.chat.id}`);
    await ctx.reply(HELP, { disable_web_page_preview: true });
  });

  bot.help(async (ctx) => ctx.reply(HELP, { disable_web_page_preview: true }));

  bot.on("text", async (ctx) => {
    console.log(`[tg] 📩 from ${ctx.chat.id}: ${ctx.message.text.slice(0, 60)}`);
    try {
      await handleMessage(makeCtx(ctx), { text: ctx.message.text });
    } catch (err) {
      console.error(`[tg] text failed: ${err.message}`);
      await ctx.reply(GENERIC_ERROR);
    }
  });

  bot.on("photo", async (ctx) => {
    console.log(`[tg] 📩 photo from ${ctx.chat.id}`);
    try {
      const photo = await downloadPhoto(ctx, token);

      if (photo?.tooLarge) {
        return ctx.reply(
          `That image is ${(photo.bytes / 1_048_576).toFixed(1)}MB, too large for me to read. Send a smaller screenshot, or type the name.`
        );
      }
      if (!photo) return ctx.reply("I couldn't download that image. Please type the company name instead.");

      await handleMessage(makeCtx(ctx), {
        text: ctx.message.caption || "",
        imageBase64: photo.base64,
        mimeType: photo.mimeType,
      });
    } catch (err) {
      console.error(`[tg] photo failed: ${err.message}`);
      await ctx.reply(GENERIC_ERROR);
    }
  });

  bot.on(["voice", "audio", "video_note"], async (ctx) => {
    await handleMessage(makeCtx(ctx), { isVoice: true });
  });

  bot.catch((err) => console.error(`[tg] unhandled: ${err.message}`));

  bot.launch().then(() => console.log("[tg] ✅ Telegram bot connected"));

  // Telegraf keeps long-polling, so stop it explicitly on shutdown.
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));

  return bot;
}
