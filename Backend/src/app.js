import cors from "cors";
import express from "express";
import helmet from "helmet";

import { errorHandler, notFound } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/api.js";
import v1Routes from "./routes/index.js";
import { checkLlmStatus } from "./services/aiAnalyzer.js";

/** Builds the Express app without connecting to anything, so tests can use it. */
export function createApp() {
  const app = express();

  // Behind a proxy the client IP arrives in X-Forwarded-For; without this the
  // public rate limiter would see every request as coming from one address.
  app.set("trust proxy", 1);

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(helmet());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );
  // Large bodies only where images arrive. The first parser to read a body wins.
  const imageBody = express.json({ limit: "12mb" });
  app.use("/v1/public/check", imageBody);
  app.use("/api/evidence/image", imageBody);
  app.use(express.json({ limit: "100kb" }));

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

  return app;
}
