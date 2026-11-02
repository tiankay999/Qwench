import axios from "axios";

const BASE_URL = (process.env.API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");

const client = axios.create({
  baseURL: BASE_URL,
  // Images and pages can take a while to read.
  timeout: Number(process.env.API_TIMEOUT_MS) || 90000,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  config.headers["X-Channel-Key"] = process.env.CHANNEL_API_KEY || "";
  return config;
});

console.log(`[api] Qwench backend base URL: ${BASE_URL}`);

/**
 * POST /v1/public/check -- send the whole message. The API finds what to check.
 * The sender is a reference only: the API hashes it and uses it for the daily limit.
 */
export async function checkMessage(input, sender) {
  const { data } = await client.post("/v1/public/check", { ...input, channel: "whatsapp", sender_ref: sender });
  return data;
}

/** POST /v1/public/reports -- opens a review. It never changes a public result. */
export async function submitReport(schemeName, sender) {
  const { data } = await client.post("/v1/public/reports", {
    scheme_name: schemeName,
    channel: "whatsapp",
    sender_ref: sender,
  });
  return data;
}

/** Quick reachability probe used at startup. */
export async function pingBackend() {
  if (!process.env.CHANNEL_API_KEY) {
    console.warn("[api] ⚠️  CHANNEL_API_KEY is not set, so the API will refuse every check. See .env.example");
  }
  try {
    await client.get("/health", { timeout: 5000 });
    console.log("[api] backend is up");
    return true;
  } catch {
    console.warn(`[api] ⚠️  backend not reachable at ${BASE_URL} -- start it with "pnpm dev" in Backend/`);
    return false;
  }
}
