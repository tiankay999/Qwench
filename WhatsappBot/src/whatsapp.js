import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

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
// Phone number to link with an 8-digit pairing code instead of scanning a QR code (e.g. 233504421995)
const PAIRING_NUMBER = (process.env.PAIRING_NUMBER || "").replace(/[^0-9]/g, "");
// WhatsApp images are small; refuse anything the vision model would reject.
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL || "silent" });

let reconnectAttempts = 0;
/**
 * Only one socket may be live at a time.
 *
 * A reconnect used to call startWhatsApp() from inside the old socket's own
 * connection.update handler without ending that socket or dropping its
 * listeners. Two sockets then shared one auth directory, and the boot purge in
 * the newer one deleted the keys the older one was still pairing with. The
 * generation counter makes a stale socket's events no-ops, and the old socket
 * is ended before a new one is built.
 */
let activeSock = null;
let generation = 0;

function endSocket(sock) {
  if (!sock) return;
  try {
    // creds.update is deliberately left attached: a save queued just before a
    // successful pair must still land on disk, and the handler only writes.
    sock.ev.removeAllListeners("connection.update");
    sock.ev.removeAllListeners("messages.upsert");
  } catch {
    // the emitter may already be torn down
  }
  try {
    sock.end(undefined);
  } catch {
    // already closed
  }
}

/** Shows enough of the number to spot a wrong one, without printing it whole. */
const maskNumber = (digits) => (digits.length < 6 ? "(too short)" : `${digits.slice(0, 5)}…${digits.slice(-2)} (${digits.length} digits)`);
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

export function clearAuthDir() {
  try {
    if (existsSync(AUTH_DIR)) {
      const entries = readdirSync(AUTH_DIR);
      for (const entry of entries) {
        if (entry === "bot.lock") continue;
        try {
          rmSync(join(AUTH_DIR, entry), { recursive: true, force: true });
        } catch {
          // ignore transient busy handles
        }
      }
      console.log(`[wa] 🧹 Session cache cleared from ${AUTH_DIR}`);
    }
  } catch (err) {
    console.error(`[wa] failed to clear ${AUTH_DIR}:`, err.message);
  }
}

export async function startWhatsApp() {
  const myGeneration = ++generation;
  endSocket(activeSock);
  activeSock = null;

  if (process.env.RESET_AUTH === "true" || process.env.FORCE_RESET_AUTH === "true") {
    console.log(`[wa] RESET_AUTH requested -- clearing ${AUTH_DIR}...`);
    clearAuthDir();
  }

  // If previous pairing was incomplete/unregistered, purge stale tokens so we don't reconnect to a dead session
  const credsFile = join(AUTH_DIR, "creds.json");
  if (existsSync(credsFile)) {
    try {
      const savedCreds = JSON.parse(readFileSync(credsFile, "utf8"));
      if (!savedCreds.registered || !savedCreds.me) {
        console.log(`[wa] ⚠️ Incomplete or expired session found in ${AUTH_DIR}. Resetting for clean pairing...`);
        clearAuthDir();
      }
    } catch {
      clearAuthDir();
    }
  }

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
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    /* Baileys gets a fixed pool of pairing refs and rotates them: the first
       lives 60s, each later one 20s. The pool is exhausted in about two
       minutes, and the socket then closes with `timedOut` — which silently
       kills the code already printed in the logs. Reading a code out of a
       Coolify log pane and typing it on a phone takes longer than that. A long
       first ref keeps one pairing session alive while the code is being used. */
    ...(PAIRING_NUMBER ? { qrTimeout: 10 * 60 * 1000 } : {}),
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    getMessage: async (key) => {
      return messageStore.get(key.id) || undefined;
    },
  });

  activeSock = sock;
  sock.ev.on("creds.update", saveCreds);

  /* Link with an 8-digit code instead of a QR when PAIRING_NUMBER is set.
     The code is requested on the first `qr` event, not on a timer. That event
     is Baileys telling us the server answered `pair-device`, so the pairing
     session is provably live; the old 3-second timer fired whether or not the
     socket had got that far. */
  const pairingWanted = Boolean(PAIRING_NUMBER) && !sock.authState.creds.registered;
  let pairingRequested = false;

  async function issuePairingCode() {
    if (pairingRequested || myGeneration !== generation) return;
    pairingRequested = true;
    try {
      const rawCode = await sock.requestPairingCode(PAIRING_NUMBER);
      const formatted = rawCode?.match(/.{1,4}/g)?.join("-") || rawCode;
      console.log("");
      console.log("===========================================================");
      console.log("  📱  WHATSAPP 8-DIGIT PAIRING CODE");
      console.log(`      Your code:  ${formatted}  (or: ${rawCode})`);
      console.log("===========================================================");
      console.log(`  Issued for: +${maskNumber(PAIRING_NUMBER)}`);
      console.log("  This must be the SAME number you are linking on the phone.");
      console.log("  It needs the country code and no leading zero —");
      console.log("  e.g. 233501234567, never 0501234567.");
      console.log("===========================================================");
      console.log("  1. Open WhatsApp on that phone");
      console.log("  2. Settings (or ⋮) > Linked devices > Link a device");
      console.log("  3. Tap 'Link with phone number instead' at the bottom");
      console.log(`  4. Enter: ${rawCode}`);
      console.log("===========================================================");
      console.log("  The session is held open for 10 minutes. If the code is");
      console.log("  refused, wait for the next one rather than retyping this.");
      console.log("===========================================================");
      console.log("");
    } catch (err) {
      pairingRequested = false;
      console.error("[wa] failed to request pairing code:", err.message);
    }
  }

  sock.ev.on("connection.update", (update) => {
    // A socket replaced by a reconnect must not act on its own death throes.
    if (myGeneration !== generation) return;

    const { connection, lastDisconnect, qr } = update;

    // The server is ready to pair: ask for the code now.
    if (qr && pairingWanted) issuePairingCode();

    if (qr && !PAIRING_NUMBER) {
      console.log("");
      console.log("===========================================================");
      console.log("  📱  SCAN THIS QR CODE WITH WHATSAPP");
      console.log("      WhatsApp > Settings > Linked devices > Link a device");
      console.log("===========================================================");
      console.log("");
      qrcode.generate(qr, { small: QR_SMALL }, (art) => console.log(art));
      console.log("");
      console.log("  (Tip: Set PAIRING_NUMBER in .env to link with an 8-digit code instead of QR!)");
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

      /* A pairing attempt that ran out of refs closes as `timedOut`, not
         `loggedOut`. That used to fall through to the backoff below, which
         rebuilt the socket, hit the boot purge, and issued a different code —
         so the one on screen stopped working with nothing in the log to say
         so. Both endings are now the same ending, and both say it plainly. */
      /* 515 is NOT a failure: WhatsApp asks for a reconnect immediately after
         a pairing succeeds. Clearing the auth directory here would throw away
         the credentials at the exact moment they were earned. Reconnect at
         once and keep them. */
      if (statusCode === DisconnectReason.restartRequired) {
        console.log("[wa] 🔗 pairing accepted — reconnecting with the new credentials...");
        setTimeout(() => startWhatsApp().catch((err) => console.error("[wa] restart failed:", err)), 1000);
        return;
      }

      const pairingDied = pairingWanted && statusCode === DisconnectReason.timedOut;

      if (statusCode === DisconnectReason.loggedOut || pairingDied) {
        console.log("");
        console.log("[wa] ❌ That pairing code is now dead — the session behind it closed.");
        console.log("[wa]    Any code still on your screen will be refused. Wait for the next one.");
        console.log(`[wa] 🔄 Clearing ${AUTH_DIR} and restarting for a fresh code...`);
        console.log("");
        clearAuthDir();
        // Allow logs to flush and give Docker 2s before restarting cleanly
        setTimeout(() => process.exit(1), 2000);
        return;
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
