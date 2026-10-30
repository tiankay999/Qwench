import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";

import { routeMessage } from "./router.js";

const AUTH_DIR = process.env.AUTH_DIR || "./auth";
const ALLOW_GROUPS = process.env.ALLOW_GROUPS === "true";
// Narrow terminals render the compact QR better; set QR_SMALL=false for the big one.
const QR_SMALL = process.env.QR_SMALL !== "false";

const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL || "silent" });

let reconnectAttempts = 0;

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
    if (type !== "notify") return;

    for (const msg of messages) {
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

  if (!jid || msg.key.fromMe) return;
  if (jid === "status@broadcast") return;

  const isGroup = jid.endsWith("@g.us");
  if (isGroup && !ALLOW_GROUPS) {
    console.log(`[wa] ignoring group message from ${jid} (set ALLOW_GROUPS=true to enable)`);
    return;
  }

  const text = extractText(msg.message);
  if (!text) {
    console.log(`[wa] ignoring non-text message from ${jid}`);
    return;
  }

  const phone = jid.split("@")[0];
  console.log(`[wa] 📩 from +${phone}: ${text}`);

  const send = async (body) => {
    await sock.sendMessage(jid, { text: body });
    console.log(`[wa] 📤 to +${phone}: ${body.split("\n")[0].slice(0, 60)}...`);
  };

  // Show the typing bubble so the wait for the API feels intentional.
  await sock.sendPresenceUpdate("composing", jid).catch(() => {});

  await routeMessage({ jid, phone, send }, text);

  await sock.sendPresenceUpdate("paused", jid).catch(() => {});
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
