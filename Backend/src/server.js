import "dotenv/config";

import cors from "cors";
import express from "express";

import { connectDB } from "./config/db.js";
import apiRoutes from "./routes/api.js";
import { checkLlmStatus } from "./services/aiAnalyzer.js";
import { bootstrapSecData } from "./services/bootstrapData.js";

const app = express();
const PORT = process.env.API_PORT || 4000;

app.use(cors());
app.use(express.json());

// Simple request logger so you can watch the bot hitting the API during the demo.
app.use((req, _res, next) => {
  console.log(`[api] ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/health", async (_req, res) => {
  const llm = await checkLlmStatus();
  res.json({
    ok: true,
    service: "qwench-api",
    llm: {
      connected: Boolean(llm.ok),
      provider: llm.provider,
      model: llm.model,
      error: llm.error || llm.reason || null,
      latencyMs: llm.latencyMs || null,
    },
    time: new Date().toISOString(),
  });
});

app.use("/api", apiRoutes);

app.use((req, res) => res.status(404).json({ ok: false, error: `No route for ${req.method} ${req.originalUrl}` }));

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
