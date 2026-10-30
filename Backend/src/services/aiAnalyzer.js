import AiAnalysis from "../models/AiAnalysis.js";

/* ------------------------------------------------------------------ *
 * System prompt -- the contract between Qwench and the model.
 * ------------------------------------------------------------------ */

export const SYSTEM_PROMPT = `You are Qwench Risk Analyzer — an AI investment risk assessment engine built for Ghana's Securities and Exchange Commission (SEC Ghana) ecosystem.

YOUR ROLE: Analyze investment data and produce a structured risk assessment based strictly on SEC Ghana's regulatory framework.

LEGAL FRAMEWORK YOU OPERATE UNDER:
- Securities Industry Act, 2016 (Act 929)
- Securities Industry (Amendment) Act, 2021 (Act 1062)
- Virtual Asset Service Providers Act, 2025 (Act 1154)
- SEC Public Notice SEC/PN/002/07/2025 (Fraudulent Schemes Alert)

SEC GHANA'S OFFICIAL RED FLAGS FOR FRAUD:
1. Operating without a valid SEC license (Section 109, Act 929)
2. Promising unrealistic returns — SEC specifically cited 6%, 10%, 20%, 40%, 70% monthly returns as fraud indicators
3. Guaranteeing "fixed" or "daily" returns (Ponzi/pyramid indicator)
4. Using AI-generated impersonation of public figures
5. Using images/names of officials without consent
6. Faceless operations — no verifiable address, team, or license number
7. Operating only through social media with no registered office
8. No proper risk disclosure to investors
9. Requiring "tasks" or recruitment for income (MLM/pyramid)
10. Mass public advertising without SEC approval

SEC GHANA VIRTUAL ASSET SANDBOX (approved VASPs under Act 1154):
AFRICOIN, BLU PENGUIN, GOLDBOD, HANYPAY, HYRO EXCHANGE GH LTD, HSB GLOBAL, KOINKOIN, WHITEBITS, VAULTA, XCHAIN, BSYSTEM LTD
— These have provisional approval only, NOT full licenses.

SCORING WEIGHTS:
- Licensing status: 40% (SEC blacklisted = automatic critical risk)
- Return promises / financial red flags: 25%
- Operational transparency: 20%
- Digital asset technical checks: 15%
- Community reports: supplementary boost (+0.5 to +2.0)

You will receive structured data about an entity. Analyze it and return a JSON response ONLY — no markdown, no extra text.

RESPONSE FORMAT (strict JSON):
{
  "entityName": "string",
  "riskScore": number (0-10, one decimal),
  "riskVerdict": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "riskColor": "green" | "yellow" | "orange" | "red",
  "summary": "One sentence verdict in plain English",
  "secStatus": {
    "status": "blacklisted" | "licensed" | "sandbox" | "unregistered",
    "detail": "string explaining the SEC status",
    "citation": "string — which law or notice applies"
  },
  "redFlags": [
    {
      "flag": "string — the red flag",
      "severity": "critical" | "high" | "medium" | "low",
      "source": "string — where this flag comes from (SEC notice, CoinGecko, GoPlus, community)"
    }
  ],
  "positiveSignals": [
    {
      "signal": "string — positive indicator",
      "source": "string"
    }
  ],
  "recommendation": "string — 2-3 sentence plain-language advice for a regular person in Ghana",
  "scoreBreakdown": {
    "licensing": number (0-40),
    "returnFlags": number (0-25),
    "transparency": number (0-20),
    "digitalAsset": number (0-15),
    "communityBoost": number (0-2)
  },
  "disclaimer": "This assessment is based on publicly available data and SEC Ghana regulatory information. Always verify directly with SEC Ghana (0800100065) before making investment decisions."
}

RULES:
- If entity is SEC Ghana blacklisted → riskScore MUST be 8.0+ and verdict MUST be "CRITICAL"
- If entity is SEC Ghana licensed → riskScore should reflect that but still check other factors
- If entity is in the sandbox → note it's provisional, not fully licensed
- NEVER say an unregistered entity is safe — under Act 929, operating without a license is illegal
- Use Ghanaian context — reference cedis, local schemes, and patterns common in Ghana
- Keep the recommendation in simple English that a non-finance person understands
- Always cite the specific SEC policy or Act behind each red flag
- If you don't have enough data to score a category, say so and assign a cautious middle score`;

/* ------------------------------------------------------------------ *
 * Config
 * ------------------------------------------------------------------ */

const DEFAULT_MODELS = {
  groq: "llama-3.3-70b-versatile",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash",
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function config() {
  const provider = (process.env.AI_PROVIDER || "groq").toLowerCase();
  const key =
    provider === "groq"
      ? process.env.GROQ_API_KEY
      : provider === "openai"
        ? process.env.OPENAI_API_KEY
        : process.env.GEMINI_API_KEY;

  return {
    provider,
    model: process.env.AI_MODEL || DEFAULT_MODELS[provider] || DEFAULT_MODELS.groq,
    key,
    enabled: Boolean(key),
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 25000,
  };
}

export function aiStatus() {
  const c = config();
  return { provider: c.provider, model: c.model, enabled: c.enabled };
}

/* ------------------------------------------------------------------ *
 * Prompt building
 * ------------------------------------------------------------------ */

/** Builds the user message from the raw evidence gathered by the risk engine. */
export function buildUserPrompt(input) {
  const { query, secData, coinGeckoData, goPlusData, communityReports, additionalContext } = input;

  const comments = (communityReports?.recentComments || []).filter(Boolean);

  return `Analyze this investment entity for risk. Here is the data collected from our sources:

Entity searched: ${query}

SEC Ghana Database Result:
${json(secData)}

CoinGecko Market Data:
${json(coinGeckoData)}

GoPlus Security Scan:
${json(goPlusData)}

Community Reports:
${communityReports?.count ?? 0} reports filed. Recent comments: ${comments.length ? comments.map((c) => `"${c}"`).join("; ") : "none"}

${additionalContext ? `Additional context: ${additionalContext}\n` : ""}Produce your risk assessment.`;
}

function json(value) {
  if (value == null) return "null (no data available from this source)";
  return JSON.stringify(value, null, 2);
}

/* ------------------------------------------------------------------ *
 * Providers
 * ------------------------------------------------------------------ */

async function callGroq({ model, key, timeoutMs }, userPrompt) {
  const { default: Groq } = await import("groq-sdk");
  const client = new Groq({ apiKey: key, timeout: timeoutMs });

  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  return res.choices?.[0]?.message?.content || "";
}

async function callOpenAI({ model, key, timeoutMs }, userPrompt) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: key, timeout: timeoutMs });

  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  return res.choices?.[0]?.message?.content || "";
}

async function callGemini({ model, key }, userPrompt) {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(key);

  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  });

  const res = await genModel.generateContent(userPrompt);
  return res.response.text();
}

const PROVIDERS = { groq: callGroq, openai: callOpenAI, gemini: callGemini };

/* ------------------------------------------------------------------ *
 * Response parsing and validation
 * ------------------------------------------------------------------ */

/** Models sometimes wrap JSON in prose or a code fence. Dig it out. */
export function extractJson(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("empty response");

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("no JSON object in response");
    return JSON.parse(candidate.slice(start, end + 1));
  }
}

const VERDICTS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const COLORS = ["green", "yellow", "orange", "red"];
const SEVERITIES = ["critical", "high", "medium", "low"];

export function verdictForScore(score) {
  if (score <= 3) return { riskVerdict: "LOW", riskColor: "green" };
  if (score < 6) return { riskVerdict: "MEDIUM", riskColor: "yellow" };
  if (score < 8) return { riskVerdict: "HIGH", riskColor: "orange" };
  return { riskVerdict: "CRITICAL", riskColor: "red" };
}

/**
 * Normalise and police the model's output.
 *
 * The prompt states hard rules, but a language model can ignore them, so the
 * ones that matter for safety are enforced here in code. Every correction is
 * recorded so a wrong verdict can be traced later.
 */
export function validateAssessment(parsed, evidence) {
  const corrections = [];
  const status = evidence?.secData?.status || "unregistered";

  let score = Number(parsed.riskScore);
  if (!Number.isFinite(score)) {
    score = 5;
    corrections.push("riskScore missing or not a number, defaulted to 5");
  }
  score = Math.max(0, Math.min(10, score));

  // Hard rule: a blacklisted entity is never scored below 8.
  if (status === "blacklisted" && score < 8) {
    corrections.push(`model scored a blacklisted entity ${score}, raised to 8.0`);
    score = 8;
  }

  // Hard rule: never let an unregistered entity be called low risk outright.
  if (status === "unregistered" && score < 2.5) {
    corrections.push(`model scored an unregistered entity ${score}, raised to 2.5`);
    score = 2.5;
  }

  // A licensed entity with no community complaints should not read as alarming.
  const reportCount = evidence?.communityReports?.count || 0;
  if (status === "licensed" && reportCount < 3 && score > 3) {
    corrections.push(`model scored a licensed entity with no complaints ${score}, lowered to 3.0`);
    score = 3;
  }

  score = Number(score.toFixed(1));

  // Verdict and colour must agree with the final score.
  const derived = verdictForScore(score);
  let riskVerdict = String(parsed.riskVerdict || "").toUpperCase();
  if (!VERDICTS.includes(riskVerdict) || riskVerdict !== derived.riskVerdict) {
    if (VERDICTS.includes(riskVerdict) && riskVerdict !== derived.riskVerdict) {
      corrections.push(`verdict "${riskVerdict}" did not match score ${score}, set to ${derived.riskVerdict}`);
    }
    riskVerdict = derived.riskVerdict;
  }

  let riskColor = String(parsed.riskColor || "").toLowerCase();
  if (!COLORS.includes(riskColor) || riskColor !== derived.riskColor) riskColor = derived.riskColor;

  const redFlags = asArray(parsed.redFlags)
    .map((f) => {
      if (typeof f === "string") return { flag: f, severity: "medium", source: "AI analysis" };
      const severity = String(f?.severity || "").toLowerCase();
      return {
        flag: String(f?.flag || "").trim(),
        severity: SEVERITIES.includes(severity) ? severity : "medium",
        source: String(f?.source || "AI analysis").trim(),
      };
    })
    .filter((f) => f.flag);

  const positiveSignals = asArray(parsed.positiveSignals)
    .map((s) =>
      typeof s === "string"
        ? { signal: s, source: "AI analysis" }
        : { signal: String(s?.signal || "").trim(), source: String(s?.source || "AI analysis").trim() }
    )
    .filter((s) => s.signal);

  const sec = parsed.secStatus || {};

  return {
    assessment: {
      entityName: String(parsed.entityName || evidence?.query || "").trim(),
      riskScore: score,
      riskVerdict,
      riskColor,
      summary: String(parsed.summary || "").trim(),
      secStatus: {
        status: String(sec.status || status),
        detail: String(sec.detail || "").trim(),
        citation: String(sec.citation || "").trim(),
      },
      redFlags,
      positiveSignals,
      recommendation: String(parsed.recommendation || "").trim(),
      scoreBreakdown: {
        licensing: num(parsed.scoreBreakdown?.licensing, 0, 40),
        returnFlags: num(parsed.scoreBreakdown?.returnFlags, 0, 25),
        transparency: num(parsed.scoreBreakdown?.transparency, 0, 20),
        digitalAsset: num(parsed.scoreBreakdown?.digitalAsset, 0, 15),
        communityBoost: num(parsed.scoreBreakdown?.communityBoost, 0, 2),
      },
      disclaimer:
        String(parsed.disclaimer || "").trim() ||
        "This assessment is based on publicly available data and SEC Ghana regulatory information. Always verify directly with SEC Ghana (0800100065) before making investment decisions.",
    },
    corrections,
  };
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function num(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, Math.round(n * 10) / 10));
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

/**
 * Run the AI assessment for one entity.
 *
 * Returns the validated assessment, or null when the AI is disabled or the
 * call fails -- the caller then uses the rule-based score instead, so the bot
 * never fails silently.
 *
 * `callProvider` is injectable for testing.
 */
export async function analyzeWithAI(evidence, { callProvider } = {}) {
  const cfg = config();

  if (!cfg.enabled && !callProvider) {
    console.log(`[ai] no API key for provider "${cfg.provider}" -- using rule-based scoring`);
    return null;
  }

  const slug = evidence.slug || evidence.query;

  /* --- 24h cache ------------------------------------------------- */
  const cached = await AiAnalysis.findOne({
    querySlug: slug,
    ok: true,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean()
    .catch(() => null);

  if (cached?.output?.riskScore != null) {
    const ageH = ((Date.now() - new Date(cached.createdAt).getTime()) / 3_600_000).toFixed(1);
    console.log(`[ai] cache hit for "${slug}" (${ageH}h old) -- skipping ${cached.provider} call`);
    return { ...cached.output, fromCache: true, provider: cached.provider, model: cached.model };
  }

  /* --- Call the model -------------------------------------------- */
  const userPrompt = buildUserPrompt(evidence);
  const fn = callProvider || PROVIDERS[cfg.provider];

  if (!fn) {
    console.error(`[ai] unknown AI_PROVIDER "${cfg.provider}" -- expected groq, openai or gemini`);
    return null;
  }

  console.log(`[ai] analyzing "${evidence.query}" via ${cfg.provider}/${cfg.model}`);
  const started = Date.now();
  let rawResponse = "";

  try {
    rawResponse = await fn(cfg, userPrompt);
    const latencyMs = Date.now() - started;

    const parsed = extractJson(rawResponse);
    const { assessment, corrections } = validateAssessment(parsed, evidence);

    console.log(
      `[ai] ${cfg.provider} returned ${assessment.riskScore}/10 ${assessment.riskVerdict} in ${latencyMs}ms` +
        ` (${assessment.redFlags.length} flags${corrections.length ? `, ${corrections.length} correction(s)` : ""})`
    );
    corrections.forEach((c) => console.warn(`[ai] correction: ${c}`));

    // Log the call and populate the 24h cache.
    await AiAnalysis.create({
      query: evidence.query,
      querySlug: slug,
      provider: cfg.provider,
      model: cfg.model,
      input: evidence,
      output: assessment,
      rawResponse: corrections.length ? rawResponse : "",
      ok: true,
      latencyMs,
      corrections,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    }).catch((err) => console.warn(`[ai] could not log analysis: ${err.message}`));

    return { ...assessment, fromCache: false, provider: cfg.provider, model: cfg.model, corrections };
  } catch (err) {
    const latencyMs = Date.now() - started;
    console.error(`[ai] ${cfg.provider} call failed after ${latencyMs}ms: ${err.message}`);
    console.error("[ai] falling back to rule-based scoring");

    await AiAnalysis.create({
      query: evidence.query,
      querySlug: slug,
      provider: cfg.provider,
      model: cfg.model,
      input: evidence,
      rawResponse: String(rawResponse || "").slice(0, 4000),
      ok: false,
      error: err.message,
      latencyMs,
    }).catch(() => {});

    return null;
  }
}
