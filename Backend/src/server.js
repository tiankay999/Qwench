import "dotenv/config";

import cors from "cors";
import express from "express";

import { connectDB } from "./config/db.js";
import apiRoutes from "./routes/api.js";
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

app.get("/health", (_req, res) => res.json({ ok: true, service: "qwench-api", time: new Date().toISOString() }));

app.use("/api", apiRoutes);

app.use((req, res) => res.status(404).json({ ok: false, error: `No route for ${req.method} ${req.originalUrl}` }));

await connectDB();

// Load the SEC Ghana licensed / blacklisted lists into MongoDB before serving.
await bootstrapSecData();

app.listen(PORT, () => {
  console.log("");
  console.log("  🛡️  Qwench API is running");
  console.log(`     http://localhost:${PORT}`);
  console.log(`     POST /api/check     POST /api/report`);
  console.log(`     GET  /api/reports   GET  /api/trending`);
  console.log("");
});
