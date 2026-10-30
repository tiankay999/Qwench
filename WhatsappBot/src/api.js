import axios from "axios";

const BASE_URL = (process.env.API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

const client = axios.create({
  baseURL: BASE_URL,
  timeout: Number(process.env.API_TIMEOUT_MS) || 20000,
  headers: { "Content-Type": "application/json" },
});

console.log(`[api] Qwench backend base URL: ${BASE_URL}`);

/** POST /api/check -- run a risk analysis */
export async function checkInvestment(query) {
  console.log(`[api] POST /api/check  query="${query}"`);
  const { data } = await client.post("/api/check", { query, channel: "whatsapp" });
  return data.data;
}

/** POST /api/report -- submit a community scam report */
export async function submitReport(payload) {
  console.log(`[api] POST /api/report  scheme="${payload.schemeName}" source=${payload.source}`);
  const { data } = await client.post("/api/report", payload);
  return data.data;
}

/** GET /api/trending -- most-reported schemes */
export async function getTrending(limit = 5) {
  console.log(`[api] GET /api/trending?limit=${limit}`);
  const { data } = await client.get("/api/trending", { params: { limit } });
  return data.data;
}

/** Quick reachability probe used at startup. */
export async function pingBackend() {
  try {
    const { data } = await client.get("/health", { timeout: 5000 });
    console.log(`[api] backend is up (${data.service})`);
    if (data.llm) {
      if (data.llm.connected) {
        console.log(`[ai]  🤖 LLM connected: ${data.llm.provider} (${data.llm.model}) [${data.llm.latencyMs || 0}ms]`);
      } else {
        console.log(`[ai]  ⚠️  LLM not connected: ${data.llm.error || "rule-based fallback active"}`);
      }
    }
    return true;
  } catch (err) {
    console.warn(`[api] ⚠️  backend not reachable at ${BASE_URL} -- start it with "pnpm dev" in Backend/`);
    return false;
  }
}
