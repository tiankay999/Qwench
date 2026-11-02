import "dotenv/config";

import { createApp } from "./app.js";
import { startCollectors } from "./collectors/run.js";
import { connectDB } from "./config/db.js";
import { requireSecrets } from "./config/env.js";
import { checkLlmStatus } from "./services/aiAnalyzer.js";
import { bootstrapSecData } from "./services/bootstrapData.js";

// Refuse to start without the secrets that key every identifier hash.
requireSecrets();

if (!process.env.MONGODB_URI) {
  console.error("FATAL: MONGODB_URI environment variable is required");
  process.exit(1);
}

const app = createApp();
const PORT = process.env.API_PORT || 4000;

await connectDB();

// Load the SEC Ghana licensed / blacklisted lists into MongoDB before serving.
await bootstrapSecData();

console.log("[ai] checking LLM connection...");
const llm = await checkLlmStatus(true);
if (llm.ok) {
  console.log(`[ai] 🤖 LLM status: ✅ Connected to ${llm.provider} (${llm.model}) [${llm.latencyMs}ms]`);
} else {
  console.log(`[ai] 🤖 LLM status: ❌ Not connected (${llm.provider} / ${llm.model})`);
  console.log(`     Error: ${llm.error || llm.reason}`);
  console.log(`     (Risk checks will automatically fall back to rule-based scoring)`);
}

if (process.env.COLLECTORS_ENABLED === "true") startCollectors();

app.listen(PORT, () => {
  console.log("");
  console.log("  🛡️  Qwench API is running");
  console.log(`     http://localhost:${PORT}`);
  console.log(`     Database : ✅ Connected (MongoDB)`);
  console.log(`     LLM      : ${llm.ok ? `✅ Connected (${llm.provider} / ${llm.model})` : `⚠️  Offline (${llm.error || llm.reason})`}`);
  console.log(`     POST /api/check     POST /api/report`);
  console.log(`     GET  /api/reports   GET  /api/trending`);
  console.log("");
});
