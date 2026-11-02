import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  areJidsSameUser,
  downloadMediaMessage,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";

import { handleMessage as handleConversation } from "./core/handler.js";

const AUTH_DIR = process.env.AUTH_DIR || "./auth";
const ALLOW_GROUPS = process.env.ALLOW_GROUPS === "true";
// Narrow terminals render the compact QR better; set QR_SMALL=false for the big one.
const QR_SMALL = process.env.QR_SMALL !== "false";
// WhatsApp images are small; refuse anything the vision model would reject.
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL || "silent" });

let reconnectAttempts = 0;
// Track outbound message IDs sent by the bot so it never responds to its own replies
const sentMessageIds = new Set();
// Cache recent messages so Baileys can satisfy WhatsApp retry requests (prevents decryption failures)
const messageStore = new Map();

function saveMessage(id, message) {
  if (!id || !message) return;
  if (messageStore.size > 500) {
    const oldest = messageStore.keys().next().value;
    messageStore.delete(oldest);
  }
  messageStore.set(id, message);
}

export async function startWhatsApp() {
  // Credentials live in AUTH_DIR, so you only scan the QR code once.
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[wa] using WhatsApp Web v${version.join(".")} (latest: ${isLatest})`);

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    // Keep the phone's notifications intact while we are testing.
    markOnlineOnConnect: false,
    browser: ["Qwench", "Chrome", "1.0.0"],
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    getMessage: async (key) => {
      return messageStore.get(key.id) || undefined;
    },
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("");
      console.log("===========================================================");
      console.log("  📱  SCAN THIS QR CODE WITH WHATSAPP");
      console.log("      WhatsApp > Settings > Linked devices > Link a device");
      console.log("===========================================================");
      console.log("");
      qrcode.generate(qr, { small: QR_SMALL }, (art) => console.log(art));
      console.log("");
      console.log("  (QR looks garbled? Run again with QR_SMALL=false, or");
      console.log("   widen the terminal window.)");
      console.log("");
    }

    if (connection === "connecting") {
      console.log("[wa] connecting to WhatsApp...");
    }

    if (connection === "open") {
      reconnectAttempts = 0;
      const me = sock.user?.id?.split(":")[0] || "unknown";
      console.log("");
      console.log(`[wa] ✅ connected as +${me}`);
      console.log("[wa] listening for messages -- send your bot a message to test");
      console.log("");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = Object.keys(DisconnectReason).find((k) => DisconnectReason[k] === statusCode) || statusCode;
      console.log(`[wa] connection closed (${reason})`);

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("");
        console.log("[wa] ❌ this device was logged out from the phone.");
        console.log(`[wa]    delete the ${AUTH_DIR} folder and start the bot again to re-scan.`);
        console.log("");
        process.exit(1);
      }

      reconnectAttempts += 1;
      const delay = Math.min(30000, 2000 * reconnectAttempts);
      console.log(`[wa] reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})...`);
      setTimeout(() => startWhatsApp().catch((err) => console.error("[wa] reconnect failed:", err)), delay);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    for (const msg of messages) {
      if (msg.key?.id && msg.message) {
        saveMessage(msg.key.id, msg.message);
      }
      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error("[wa] error handling message:", err);
      }
    }
  });

  return sock;
}

async function handleMessage(sock, msg) {
  const jid = msg.key?.remoteJid;

  if (!jid || jid === "status@broadcast") return;

  // Ignore outbound messages that the bot itself just sent
  if (msg.key?.id && sentMessageIds.has(msg.key.id)) {
    sentMessageIds.delete(msg.key.id);
    return;
  }

  // Ignore old messages synced on reconnect (> 60s old)
  const now = Math.floor(Date.now() / 1000);
  const msgTime = Number(msg.messageTimestamp) || 0;
  if (msgTime && now - msgTime > 60) return;

  const myId = sock.user?.id;
  const myLid = sock.user?.lid;
  const myPhone = myId?.split(":")[0]?.replace(/[^0-9]/g, "");
  const senderPhone = jid.split("@")[0]?.replace(/[^0-9]/g, "");

  const isSelfChat = Boolean(
    (myId && areJidsSameUser(jid, myId)) ||
    (myLid && areJidsSameUser(jid, myLid)) ||
    (myPhone && senderPhone === myPhone)
  );

  // If the message was sent from this account, only process it if it's in "Message yourself"
  if (msg.key.fromMe && !isSelfChat) return;

  const isGroup = jid.endsWith("@g.us");
  if (isGroup && !ALLOW_GROUPS) {
    console.log(`[wa] ignoring group message from ${jid} (set ALLOW_GROUPS=true to enable)`);
    return;
  }

  const text = extractText(msg.message);
  const media = await extractImage(sock, msg);
  const isVoice = hasVoiceNote(msg.message);
  if (!text && !media && !isVoice) return;

  const targetJid = isSelfChat && myPhone ? `${myPhone}@s.whatsapp.net` : jid;
  const phone = senderPhone || myPhone || "user";
  console.log(
    `[wa] 📩 from +${phone}${isSelfChat ? " (self-test)" : ""}: ${text || "(no caption)"}` +
      `${media ? ` [📸 ${media.mimeType}, ${(media.bytes / 1024).toFixed(0)}KB]` : ""}`
  );

  const send = async (body) => {
    const sent = await sock.sendMessage(targetJid, { text: body });
    if (sent?.key?.id) {
      sentMessageIds.add(sent.key.id);
      setTimeout(() => sentMessageIds.delete(sent.key.id), 60000);
    }
    console.log(`[wa] 📤 to +${phone}: ${body.split("\n")[0].slice(0, 60)}...`);
  };

  const ctx = {
    channel: "whatsapp",
    // The JID is the sender reference. The API hashes it with a daily salt for
    // the fair-use count and stores no sender on the check itself.
    senderId: targetJid,
    send,
    sendTyping: () => sock.sendPresenceUpdate("composing", targetJid).catch(() => {}),
  };

  await ctx.sendTyping();

  if (media?.tooLarge) {
    await send(`That image is ${(media.bytes / 1048576).toFixed(1)}MB, too large for me to read. Send a smaller screenshot, or type the name.`);
  } else {
    await handleConversation(ctx, {
      text,
      imageBase64: media?.base64,
      mimeType: media?.mimeType,
      isVoice,
    });
  }

  await sock.sendPresenceUpdate("paused", targetJid).catch(() => {});
}

/** Pull plain text out of whichever message shape WhatsApp sent. */
function extractText(message) {
  if (!message) return "";

  // Disappearing messages wrap the real content.
  const m = message.ephemeralMessage?.message || message.viewOnceMessage?.message || message;

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    ""
  ).trim();
}

/**
 * Download an image the user sent, as base64, so it can go to the vision model.
 * Returns null when the message has no image (or it could not be fetched).
 */
async function extractImage(sock, msg) {
  const m = msg.message?.ephemeralMessage?.message || msg.message?.viewOnceMessage?.message || msg.message;
  if (!m) return null;

  const image = m.imageMessage || m.documentWithCaptionMessage?.message?.documentMessage || m.documentMessage;
  if (!image) return null;

  const mimeType = image.mimetype || "image/jpeg";
  // Documents can be anything; only accept ones that are actually images.
  if (!mimeType.startsWith("image/")) {
    console.log(`[wa] ignoring non-image attachment (${mimeType})`);
    return null;
  }

  try {
    const buffer = await downloadMediaMessage(msg, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
    if (!buffer?.length) return null;

    if (buffer.length > MAX_IMAGE_BYTES) {
      console.warn(`[wa] image too large: ${(buffer.length / 1_048_576).toFixed(1)}MB`);
      return { tooLarge: true, bytes: buffer.length, mimeType };
    }

    console.log(`[wa] 📥 downloaded image: ${(buffer.length / 1024).toFixed(0)}KB ${mimeType}`);
    return { base64: buffer.toString("base64"), mimeType, bytes: buffer.length };
  } catch (err) {
    console.error(`[wa] image download failed: ${err.message}`);
    return null;
  }
}

/** WhatsApp voice notes arrive as audio with ptt set. */
function hasVoiceNote(message) {
  const m = message?.ephemeralMessage?.message || message?.viewOnceMessage?.message || message;
  return Boolean(m?.audioMessage);
}
