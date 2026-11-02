/**
 * The public API, and every label the web app is allowed to put on screen.
 *
 * All wording about an entity comes from the backend (Backend/src/engine/report.js)
 * as a fixed template. This file only lays it out. That is what keeps WhatsApp,
 * Telegram and the web app from ever saying different things about the same name.
 *
 * NEVER on screen: a score, a rating, a risk colour for a scheme, "we recommend",
 * "this is safe/unsafe", who contributed, who checked, or anyone's number.
 * See docs/spec/README.md, "Rules that must never break".
 */

/* ------------------------------------------------------------------ *
 * The reply contract
 * ------------------------------------------------------------------ */

/** A legal state. Never a verdict: `licensed` and `sandbox` are not praise. */
export type LegalState =
  | "named_in_notice"
  | "licensed"
  | "sandbox"
  | "registered"
  | "authority"
  | "no_record"
  | "foreign_context";

export type Source = {
  publisher: string;
  date: string | null;
  url: string | null;
  title?: string | null;
  quote?: string | null;
};

/** How much evidence there is. Grades the evidence, never the scheme. */
export type EvidenceLevel = {
  code: string;
  label: string;
  meaning: string;
};

export type ReturnCheck = {
  stated: string;
  annual_percent: number;
  note: string;
};

export type Report = {
  state_sentence: string;
  evidence_level: EvidenceLevel;
  sources: Source[];
  return_check: ReturnCheck | null;
  warning_signs: string[];
  /** Signs AI spotted. Shown apart, labelled, and counted toward nothing. */
  ai_warning_signs: string[];
  link_facts: string[];
  foreign_context: string[];
  also_checked: string[];
  questions_to_ask: string[];
  notes: string[];
  disclaimer: string;
  footer: string;
};

export type DidYouMean = {
  original_query?: string;
  suggested_entity: string;
};

export type CheckResult = {
  match: boolean;
  state: LegalState;
  entity: string | null;
  tier: number | null;
  reason_codes: string[];
  did_you_mean: DidYouMean | null;
  report: Report;
  is_demo: boolean;
  checked_at: string;
};

export type About = {
  data_date: string | null;
  total_records: number;
  records_by_source: { publisher: string; records: number }[];
};

export type IdentifierType =
  | "name"
  | "momo_number"
  | "bank_account"
  | "domain"
  | "wallet"
  | "social_handle"
  | "telegram_link"
  | "tiktok_handle"
  | "merchant_id";

/* ------------------------------------------------------------------ *
 * Calling the API
 * ------------------------------------------------------------------ */

/**
 * In the browser this is empty, so requests go to this site's own origin and
 * next.config.ts proxies them. That keeps the visitor's own IP on the request,
 * which is what the API's per-IP fair-use limit counts.
 */
function base() {
  if (typeof window !== "undefined") return "";
  return process.env.QWENCH_API_URL || "http://localhost:4000";
}

export class QwenchError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base()}/v1/public${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new QwenchError(0, "network", "Can't reach Qwench right now. Check your connection and try again.");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new QwenchError(
      response.status,
      data?.error?.code || "error",
      data?.error?.message || "That didn't work. Please try again.",
    );
  }
  return data as T;
}

/** What the paste box sends: free text, links, or a named entity. */
export type CheckInput = {
  text?: string;
  urls?: string[];
  recipient?: string;
  type?: IdentifierType | "url";
};

export const check = (input: CheckInput) => call<CheckResult>("/check", { ...input, channel: "web" });

/** A named entity, for a permalink. Asking by name skips the "did you mean" step. */
export const checkName = (name: string) => check({ recipient: name, type: "name" });

export const about = () => call<About>("/about");

export type ReportInput = {
  scheme_name: string;
  identifiers?: { type: IdentifierType; value: string }[];
  evidence_urls?: string[];
};

export const submitReport = (input: ReportInput) =>
  call<{ received: boolean; message: string }>("/reports", { ...input, channel: "web" });

export type AppealInput = {
  type: IdentifierType;
  value: string;
  contact: string;
  reason: string;
};

export const submitAppeal = (input: AppealInput) =>
  call<{ received: boolean; reference: string; due_date: string; message: string }>("/appeals", input);

/* ------------------------------------------------------------------ *
 * Labels
 * ------------------------------------------------------------------ */

/**
 * The badge for each legal state.
 *
 * `tone` drives the colour. It describes the kind of record, not how risky
 * anything is — `warning` means a regulator published a notice, and `listed`
 * means a name appears on a register. Neither is a rating.
 */
/**
 * The five status roles. They are categorical, never a scale: `named` is not
 * "worse" than `listed`, it is a different kind of fact. Nothing may sort,
 * rank or ramp them, because a sequence is a score. See DESIGN.md, "The Flat
 * Spectrum Rule".
 */
export type StatusTone = "named" | "reviewed" | "signs" | "listed" | "nothing";

/**
 * What each legal state is called, and which role carries it.
 *
 * There are no icons in here any more. The map used to ship emoji — and a ✅
 * on `licensed`, which told the reader a firm was approved, in a product whose
 * second rule is that it never says "safe" or "verified". Marks are now drawn,
 * and they live in StateBadge where they can be sized and stroked.
 */
export const STATE: Record<LegalState, { label: string; tone: StatusTone }> = {
  named_in_notice: { label: "Named in a notice", tone: "named" },
  licensed: { label: "On SEC Ghana's licensed list", tone: "listed" },
  sandbox: { label: "In the regulatory sandbox", tone: "listed" },
  registered: { label: "In records — not licensed", tone: "listed" },
  authority: { label: "Regulator or public body", tone: "listed" },
  no_record: { label: "No record found", tone: "nothing" },
  foreign_context: { label: "Alert from a regulator abroad", tone: "signs" },
};

export const stateOf = (state: string) => STATE[state as LegalState] ?? STATE.no_record;

/** What a tier means, in the same words the console uses. */
export const TIER: Record<number, { label: string; meaning: string }> = {
  1: { label: "Tier 1", meaning: "A regulator notice or a sanctions list." },
  2: { label: "Tier 2", meaning: "Confirmed by a partner, or an impersonation two people reviewed." },
  3: { label: "Tier 3", meaning: "Corroborated reports, reviewed by a person." },
  4: { label: "Tier 4", meaning: "A reviewed rise in checks." },
};

/** SEC Ghana 0800 100 065, Cyber Security Authority 292. Also in every footer. */
export const HOTLINES = [
  { name: "SEC Ghana", number: "0800 100 065", href: "tel:0800100065" },
  { name: "Cyber Security Authority", number: "292", href: "tel:292" },
];

/** Turn an entity name into a permalink slug, and back into a name to check. */
export const toSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const fromSlug = (slug: string) => slug.replace(/-+/g, " ").trim();
