import "dotenv/config";

import cors from "cors";
import express from "express";

import { connectDB } from "./config/db.js";
import { requireSecrets } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/api.js";
import v1Routes from "./routes/index.js";
import { checkLlmStatus } from "./services/aiAnalyzer.js";
import { bootstrapSecData } from "./services/bootstrapData.js";

// Refuse to start without the secrets that key every identifier hash.
requireSecrets();

if (!process.env.MONGODB_URI) {
  console.error("FATAL: MONGODB_URI environment variable is required");
  process.exit(1);
}

const app = express();
const PORT = process.env.API_PORT || 4000;

// Behind a proxy the client IP arrives in X-Forwarded-For; without this the
// public rate limiter would see every request as coming from one address.
app.set("trust proxy", 1);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);
app.use(express.json({ limit: "12mb" }));

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

// The /v1 contract: public (rate-limited, no auth) and institutional (API key).
app.use("/v1", v1Routes);

// The original bot API. Still serving the WhatsApp bot, which has not been
// migrated to /v1 yet. Note it returns risk scores and recommendations, which
// /v1 deliberately never does — see the note in README before exposing it.
app.use("/api", apiRoutes);

app.use(notFound);
app.use(errorHandler);

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
