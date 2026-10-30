import "dotenv/config";

import { pingBackend } from "./api.js";
import { startWhatsApp } from "./whatsapp.js";

console.log("");
console.log("  🛡️  Qwench WhatsApp bot starting...");
console.log("");

// Not fatal if the API is down -- the bot still connects and will retry per message.
await pingBackend();

startWhatsApp().catch((err) => {
  console.error("[bot] fatal startup error:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => console.error("[bot] unhandled rejection:", err));
process.on("SIGINT", () => {
  console.log("\n[bot] shutting down. Your session is saved -- no need to re-scan next time.");
  process.exit(0);
});
