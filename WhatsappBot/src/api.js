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

/** POST /api/verify-name -- anti-spoofing check that runs before a risk check */
export async function verifyName(query) {
  console.log(`[api] POST /api/verify-name  query="${query}"`);
  const { data } = await client.post("/api/verify-name", { query });
  return data.data;
}

/** POST /api/check with spoofing context and/or user-supplied evidence */
export async function checkInvestmentWithContext(query, { spoofingDetection, injectedFlags, evidence } = {}) {
  console.log(
    `[api] POST /api/check  query="${query}"` +
      `${spoofingDetection ? " +spoof" : ""}${evidence?.evidenceCount ? ` +${evidence.evidenceCount} evidence` : ""}`
  );
  const { data } = await client.post("/api/check", {
    query,
    channel: "whatsapp",
    spoofingDetection,
    injectedFlags,
    evidence,
  });
  return data.data;
}

/** POST /api/evidence/image -- analyze a forwarded screenshot */
export async function analyzeImageEvidence(base64, mimeType, entityName) {
  console.log(`[api] POST /api/evidence/image  ${(base64.length / 1365).toFixed(0)}KB for "${entityName}"`);
  const { data } = await client.post(
    "/api/evidence/image",
    { base64, mimeType, entityName },
    { timeout: 60000 }
  );
  return data.data;
}

/** POST /api/evidence/url -- fetch and analyze a link */
export async function analyzeUrlEvidence(url, entityName) {
  console.log(`[api] POST /api/evidence/url  ${url}`);
  const { data } = await client.post("/api/evidence/url", { url, entityName }, { timeout: 60000 });
  return data.data;
}
