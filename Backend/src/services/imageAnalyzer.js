import { runJsonPrompt } from "./aiAnalyzer.js";

/**
 * Reads screenshots, flyers and chat captures the user forwards as evidence,
 * and pulls out the investment-fraud signals SEC Ghana warns about.
 */

export const IMAGE_SYSTEM_PROMPT = `You are Qwench Image Analyzer. You examine screenshots, flyers, and promotional images related to investment schemes in Ghana.

Your job: Extract ALL text and claims from the image, then identify red flags based on SEC Ghana's fraud indicators.

Look for:
- Return promises (percentages, "daily profits", "guaranteed returns")
- Company names, logos, registration claims
- WhatsApp group names or Telegram channels
- "Task-based" earning claims (watch videos, complete tasks for money)
- Recruitment/referral incentives ("bring 5 friends", "downline")
- Fake celebrity endorsements or official-looking seals
- Urgency language ("join NOW", "limited slots", "closing soon")
- Screenshots of fake payment proofs or dashboards
- Any website URLs or app download links visible in the image
- Missing SEC Ghana license numbers
- Use of Ghana flag, coat of arms, or government imagery to appear legitimate

SEC Ghana's legal framework: Securities Industry Act 2016 (Act 929), Act 1062 (2021), Virtual Asset Service Providers Act 2025 (Act 1154), SEC Public Notice SEC/PN/002/07/2025.

Report only what is actually visible. If the image is unrelated to investments, say so and return empty flag lists rather than inventing findings.

Return JSON ONLY:
{
  "extractedText": "all readable text from the image",
  "entityMentioned": "company/scheme name if visible",
  "redFlags": [{"flag": "...", "severity": "critical|high|medium|low"}],
  "positiveSignals": [{"signal": "..."}],
  "returnPromises": "any % or return claims found",
  "urlsFound": ["any URLs visible in image"],
  "imageType": "screenshot|flyer|chat|payment_proof|other",
  "confidence": "high|medium|low",
  "summary": "one sentence about what this image shows"
}`;

const MAX_BYTES = 6 * 1024 * 1024; // WhatsApp images are small; cap anyway
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/**
 * Analyze one image. Never throws -- a failure comes back as
 * { error: true, summary } so the evidence flow can carry on.
 */
export async function analyzeImage(base64, mimeType = "image/jpeg", entityName = "", { callProvider } = {}) {
  if (!base64) return { error: true, summary: "No image data received" };

  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > MAX_BYTES) {
    console.warn(`[image] rejected ${(bytes / 1_048_576).toFixed(1)}MB image (limit 6MB)`);
    return { error: true, summary: "That image is too large to analyze. Try a smaller screenshot." };
  }

  const type = ALLOWED.includes(mimeType) ? mimeType : "image/jpeg";

  const user = `Analyze this image. The user is asking about an entity called "${entityName || "unknown"}". Extract all information and identify investment fraud red flags based on SEC Ghana criteria.`;

  try {
    console.log(`[image] analyzing ${(bytes / 1024).toFixed(0)}KB ${type} for "${entityName}"`);
    const { parsed, latencyMs, provider, model } = await runJsonPrompt({
      system: IMAGE_SYSTEM_PROMPT,
      user,
      images: [{ base64, mimeType: type }],
      vision: true,
      callProvider,
    });

    const result = normalizeImageResult(parsed);
    console.log(
      `[image] ${provider}/${model} found ${result.redFlags.length} flag(s) in ${latencyMs}ms ` +
        `(type: ${result.imageType}, confidence: ${result.confidence})`
    );
    return result;
  } catch (err) {
    console.error(`[image] analysis failed: ${err.message}`);
    return { error: true, summary: "Could not analyze image", reason: err.message };
  }
}

const SEVERITIES = ["critical", "high", "medium", "low"];

function normalizeImageResult(p) {
  const flags = (Array.isArray(p.redFlags) ? p.redFlags : [])
    .map((f) => {
      if (typeof f === "string") return { flag: f, severity: "medium" };
      const sev = String(f?.severity || "").toLowerCase();
      return { flag: String(f?.flag || "").trim(), severity: SEVERITIES.includes(sev) ? sev : "medium" };
    })
    .filter((f) => f.flag);

  const signals = (Array.isArray(p.positiveSignals) ? p.positiveSignals : [])
    .map((s) => (typeof s === "string" ? { signal: s } : { signal: String(s?.signal || "").trim() }))
    .filter((s) => s.signal);

  const confidence = String(p.confidence || "").toLowerCase();

  return {
    error: false,
    extractedText: String(p.extractedText || "").slice(0, 4000),
    entityMentioned: String(p.entityMentioned || "").trim(),
    redFlags: flags,
    positiveSignals: signals,
    returnPromises: String(p.returnPromises || "").trim(),
    urlsFound: (Array.isArray(p.urlsFound) ? p.urlsFound : []).map((u) => String(u).trim()).filter(Boolean),
    imageType: String(p.imageType || "other").toLowerCase(),
    confidence: ["high", "medium", "low"].includes(confidence) ? confidence : "low",
    summary: String(p.summary || "").trim() || "Image analyzed",
  };
}
