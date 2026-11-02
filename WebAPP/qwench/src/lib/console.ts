// Talks to /v1/console through this site's own origin (see next.config.ts). The
// session is an httpOnly cookie, so nothing here ever handles a token or API key.

export type Role = "analyst" | "org_admin" | "reviewer" | "regulator";

export type ConsoleUser = {
  email: string;
  role: Role;
  organization: string;
  is_demo: boolean;
};

export type Source = {
  publisher: string;
  title?: string;
  date: string | null;
  url: string | null;
  quote?: string | null;
};

export type Report = {
  evidence_level: { code: string; label: string; meaning: string };
  disclaimer: string;
  state_sentence: string;
  foreign_context: string[];
  also_checked: string[];
  sources: Source[];
  return_check: { stated: string; annual_percent: number; note: string } | null;
  warning_signs: string[];
  questions_to_ask: string[];
  notes: string[];
  footer: string;
};

export type CheckResult = {
  match: boolean;
  entity: string | null;
  state: string;
  tier: number | null;
  reason_codes: string[];
  sources: Source[];
  allowed_use: string | null;
  suggested_action: string;
  did_you_mean?: { suggested_entity: string } | null;
  report: Report;
  is_demo: boolean;
  checked_at: string;
  member_report_count?: number;
  signal?: { checks_this_week: number; checks_last_week: number; distinct_sources: number } | null;
};

export type FeedRecord = {
  change: "added" | "updated" | "removed";
  entity: string;
  state: string;
  record_type: string;
  jurisdiction: string;
  source: { publisher: string; title: string; date: string; url: string | null };
  quote?: string;
  identifiers: { type: string; value: string }[];
  updated_at: string;
  is_demo: boolean;
};

export type Feed = { count: number; records: FeedRecord[]; next_cursor: string | null };

export type ApiKey = {
  id: string;
  prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  key?: string;
};

export type QueueItem = {
  id: string;
  kind: "record" | "relation" | "public_report" | "contribution" | "signal" | "notice";
  aliases?: string[];
  url?: string;
  document_url?: string | null;
  published_on?: string;
  note?: string | null;
  websites?: string[];
  title: string;
  can_review: boolean;
  created_at?: string;
  captured_by?: string | null;
  record_type?: string;
  jurisdiction?: string;
  quote?: string | null;
  source?: { publisher: string; title: string; date: string; url: string | null } | null;
  relation_type?: string;
  from_entity?: string | null;
  to_entity?: string | null;
  channel?: string | null;
  evidence?: string[];
  volume_flag?: boolean;
  terms?: string | null;
  region?: string | null;
  loss_band?: string | null;
  identifier_types?: string[];
  checks_this_week?: number;
  checks_last_week?: number;
  distinct_sources?: number;
};

export type CollectorStatus = {
  collectors: { collector: string; publisher: string; last_success_at: string | null; last_error: string | null; stale: boolean }[];
  pending_records: number;
  notices_needing_a_person: number;
};

export class ConsoleError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const SESSION_ENDED = "qwench:session-ended";

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/v1/console${path}`, {
      method: options.method || (options.body ? "POST" : "GET"),
      headers: options.body ? { "content-type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ConsoleError(0, "network", "Can't reach the Qwench API. Check your connection and try again.");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== "/login" && path !== "/me") window.dispatchEvent(new Event(SESSION_ENDED));
    throw new ConsoleError(response.status, data?.error?.code || "error", data?.error?.message || "That didn't work. Try again.");
  }
  return data as T;
}

export const IDENTIFIER_TYPES = [
  { value: "momo_number", label: "MoMo number" },
  { value: "bank_account", label: "Bank account" },
  { value: "name", label: "Name" },
  { value: "domain", label: "Website" },
  { value: "wallet", label: "Crypto wallet" },
  { value: "social_handle", label: "Social handle" },
  { value: "telegram_link", label: "Telegram link" },
  { value: "tiktok_handle", label: "TikTok handle" },
  { value: "merchant_id", label: "Merchant ID" },
];

/** A starting guess for the type menu. The person can always change it. */
export function guessType(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^0x[a-f0-9]{40}$/i.test(v)) return "wallet";
  if (/^\+?[\d\s()-]{9,16}$/.test(v)) return "momo_number";
  if (/t\.me\/|telegram\.me\//i.test(v)) return "telegram_link";
  if (/tiktok\.com\//i.test(v)) return "tiktok_handle";
  if (/^https?:\/\//i.test(v) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(v)) return "domain";
  if (/^@/.test(v)) return "social_handle";
  return "name";
}

export const STATE_LABEL: Record<string, string> = {
  named_in_notice: "Named in a notice",
  licensed: "Licensed",
  sandbox: "In sandbox",
  registered: "Registered",
  authority: "Regulator or public body",
  no_record: "No record",
  foreign_context: "Foreign alert, context only",
};

export const TIER_LABEL: Record<number, string> = {
  1: "Tier 1: regulator notice or sanctions list",
  2: "Tier 2: partner-confirmed, or a reviewed impersonation",
  3: "Tier 3: corroborated reports",
  4: "Tier 4: reviewed rise in checks",
};

export const REASON_LABEL: Record<string, string> = {
  REGULATOR_NOTICE: "A regulator named this in a notice",
  SANCTIONS_LIST: "This is on a sanctions list",
  PARTNER_CONFIRMED: "A member organisation confirmed this",
  ADVERTISED_AS_BUSINESS_NOT_REGISTERED: "Presented as a business it isn't part of, after review",
  CORROBORATED_REPORTS: "Reports from three or more independent sources, reviewed",
  CHECK_SPIKE: "A reviewed rise in checks",
};

export const USE_LABEL: Record<string, string> = {
  customer_warning: "May warn the customer",
  internal_review: "Internal review only",
  watch: "Watch only",
};

export const ACTION_LABEL: Record<string, string> = {
  warn: "Warn the customer",
  warn_or_confirmation_call: "Warn the customer, or make a confirmation call",
  internal_review: "Review internally",
  watch: "Watch",
  none: "No action",
};

export const ROLE_LABEL: Record<Role, string> = {
  analyst: "Analyst",
  org_admin: "Organisation admin",
  reviewer: "Reviewer",
  regulator: "Regulator",
};

export const API_SCOPES = [
  { value: "check", label: "Check", hint: "POST /v1/check" },
  { value: "feed", label: "Feed", hint: "GET /v1/feed" },
  { value: "contributions", label: "Contributions", hint: "POST /v1/contributions" },
  { value: "signals", label: "Signals", hint: "GET /v1/signals" },
  { value: "cases", label: "Cases", hint: "GET /v1/cases/:id" },
  { value: "merchants", label: "Merchants", hint: "POST /v1/merchants/verify-number" },
];

export const formatDate = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : "None");
