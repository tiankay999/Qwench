import "dotenv/config";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { ping } from "./core/qwench.js";
import { startTelegramBot } from "./telegram.js";
import { startWhatsApp } from "./whatsapp.js";

const AUTH_DIR = process.env.AUTH_DIR || "./auth";
const LOCK_FILE = join(AUTH_DIR, "bot.lock");

// Prevent multiple instances from running concurrently (which corrupts WhatsApp encryption keys)
function acquireInstanceLock() {
  if (!existsSync(AUTH_DIR)) {
    mkdirSync(AUTH_DIR, { recursive: true });
  }

  if (existsSync(LOCK_FILE)) {
    try {
      const existingPid = Number(readFileSync(LOCK_FILE, "utf8").trim());
      if (existingPid && existingPid !== process.pid) {
        process.kill(existingPid, 0); // Throws if process does not exist
        console.error("");
        console.error(`⚠️  [bot] Another WhatsApp bot instance is ALREADY running (PID: ${existingPid})!`);
        console.error("   Running two bot instances simultaneously corrupts WhatsApp encryption keys ('Bad MAC').");
        console.error("   Please close the other terminal tab before starting this one.");
        console.error("");
        process.exit(1);
      }
    } catch {
      // Process is not running, lock is stale -- safe to overwrite
    }
  }

  writeFileSync(LOCK_FILE, String(process.pid), "utf8");

  const cleanup = () => {
    try {
      if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
    } catch {}
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    console.log("\n[bot] shutting down. Your session is saved -- no need to re-scan next time.");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
}

acquireInstanceLock();

console.log("");
console.log("  🛡️  Qwench WhatsApp bot starting...");
console.log("");

// Handle Baileys/libsignal decryption hiccups gracefully and auto-heal corrupted/stale session files
process.on("unhandledRejection", (err) => {
  const msg = err?.message || String(err);
  const isDecryptionIssue =
    msg.includes("Bad MAC") ||
    msg.includes("Failed to decrypt") ||
    msg.includes("Over 2000 messages into the future");

  if (isDecryptionIssue) {
    // If a specific session ID is in the stack trace, prune its outdated file so Baileys re-keys
    const stack = err?.stack || "";
    const sessionMatch = stack.match(/(\d+\.\d+) \[as awaitable\]/);
    if (sessionMatch) {
      const sessionId = sessionMatch[1];
      const sessionFile = join(AUTH_DIR, `session-${sessionId}.json`);
      try {
        if (existsSync(sessionFile)) {
          unlinkSync(sessionFile);
          console.warn(`[wa] 🔄 Cleared desynced session ${sessionId}. Next message will renegotiate keys.`);
          return;
        }
      } catch {}
    }
    console.warn("[wa] ⚠️  Decryption mismatch on incoming message. Session will resync automatically.");
    return;
  }
  console.error("[bot] unhandled rejection:", err);
});

// Not fatal if the API is down -- the bot still connects and will retry per message.
await ping();

// Telegram is optional: without a token the WhatsApp channel still runs.
startTelegramBot();

startWhatsApp().catch((err) => {
  console.error("[bot] fatal startup error:", err);
  process.exit(1);
});
