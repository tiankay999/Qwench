import axios from "axios";

/**
 * Client for the Qwench public API.
 *
 * Bot channels present a shared X-Channel-Key and a sender_ref. The backend
 * hashes the sender_ref with a daily salt purely to count requests against the
 * fair-use limit; check_events holds no sender, so nothing links a person to
 * what they checked.
 */

const BASE_URL = (process.env.API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
const CHANNEL_KEY = process.env.CHANNEL_API_KEY || "";

const client = axios.create({
  baseURL: BASE_URL,
  timeout: Number(process.env.API_TIMEOUT_MS) || 30000,
  headers: { "Content-Type": "application/json" },
  // Errors carry a structured body; read it rather than throwing on status.
  validateStatus: () => true,
});

console.log(`[api] Qwench API: ${BASE_URL}`);
if (!CHANNEL_KEY) {
  console.warn("[api] ⚠️  CHANNEL_API_KEY is not set — bot checks will be rejected with 401.");
}

function headers() {
  return CHANNEL_KEY ? { "X-Channel-Key": CHANNEL_KEY } : {};
}

/** Shapes an API error into something the bot can decide on. */
function problem(res) {
  const code = res.data?.error?.code || "unknown";
  const message = res.data?.error?.message || `HTTP ${res.status}`;
  return { ok: false, status: res.status, code, message };
}

/**
 * POST /v1/public/check
 *
 * `payload` carries whatever the user actually sent: free text, links, or an
 * image. The backend decides what the input is — the bot does not try to
 * resolve entities itself, so the two can never disagree.
 */
export async function check({ channel, senderRef, text, urls, imageBase64, mimeType, recipient, type }) {
  const body = { channel, sender_ref: senderRef };

  if (text) body.text = text;
  if (urls?.length) body.urls = urls.slice(0, 3);
  if (imageBase64) {
    body.image_base64 = imageBase64;
    body.mime_type = mimeType || "image/jpeg";
  }
  // Only sent when the input is unambiguous (a number, a wallet, a domain).
  if (recipient && type) {
    body.recipient = recipient;
    body.type = type;
  }

  const res = await client.post("/v1/public/check", body, { headers: headers() });
  if (res.status >= 400) {
    console.warn(`[api] check failed: ${res.status} ${res.data?.error?.code || ""}`);
    return problem(res);
  }

  return { ok: true, ...res.data };
}

/** POST /v1/public/reports — a member of the public reports a scheme. */
export async function submitReport({ channel, senderRef, schemeName, identifiers = [], evidenceUrls = [] }) {
  const res = await client.post(
    "/v1/public/reports",
    { channel, sender_ref: senderRef, scheme_name: schemeName, identifiers, evidence_urls: evidenceUrls },
    { headers: headers() }
  );

  if (res.status >= 400) {
    console.warn(`[api] report failed: ${res.status} ${res.data?.error?.code || ""}`);
    return problem(res);
  }
  return { ok: true, ...res.data };
}

/** Startup probe, so a misconfigured bot says so before anyone messages it. */
export async function ping() {
  try {
    const res = await client.get("/health", { timeout: 6000 });
    if (res.status >= 400) {
      console.warn(`[api] ⚠️  backend returned ${res.status}`);
      return false;
    }
    console.log(`[api] backend is up (${res.data?.service || "qwench"})`);
    return true;
  } catch (err) {
    console.warn(`[api] ⚠️  backend not reachable at ${BASE_URL} — start it in Backend/ with "pnpm dev"`);
    return false;
  }
}
