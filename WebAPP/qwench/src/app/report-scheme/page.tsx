"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Plus, ShieldCheck, X } from "lucide-react";
import {
  submitReport,
  QwenchError,
  HOTLINES,
  type IdentifierType,
} from "@/lib/qwench";
import { StepProgress } from "@/components/ui/StepProgress";
import { Button } from "@/components/ui/Button";

/**
 * Submitting a report.
 *
 * A report never changes what this site says about a name — it opens a review
 * by a person, and a second person has to agree before anything becomes public
 * (docs/spec/README.md, rule 5). The form says so, because a form that implies
 * otherwise is making a promise Qwench won't keep.
 *
 * Only what POST /v1/public/reports accepts is collected: a name, identifiers,
 * and links. There is deliberately no "tell us what happened" box — the
 * endpoint has nowhere to put prose, and a reviewer can't check a story.
 */

const TYPES: { value: IdentifierType; label: string; placeholder: string }[] = [
  { value: "domain", label: "Website", placeholder: "example.com" },
  { value: "momo_number", label: "MoMo number", placeholder: "024 000 0000" },
  { value: "bank_account", label: "Bank account", placeholder: "Account number" },
  { value: "wallet", label: "Crypto wallet", placeholder: "0x…" },
  { value: "social_handle", label: "Social handle", placeholder: "@handle" },
  { value: "telegram_link", label: "Telegram link", placeholder: "t.me/…" },
  { value: "tiktok_handle", label: "TikTok", placeholder: "tiktok.com/@…" },
  { value: "name", label: "Another name they use", placeholder: "Other trading name" },
];

const TOTAL_STEPS = 4;

type Row = { type: IdentifierType; value: string };

function ReportForm() {
  const initialName = useSearchParams().get("name") ?? "";

  const [step, setStep] = useState(1);
  const [name, setName] = useState(initialName);
  const [rows, setRows] = useState<Row[]>([{ type: "domain", value: "" }]);
  const [links, setLinks] = useState<string[]>([""]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const cleanRows = rows.filter((r) => r.value.trim());
  const cleanLinks = links.map((l) => l.trim()).filter(Boolean);
  const badLinks = cleanLinks.filter((l) => !/^https?:\/\/\S+\.\S+/i.test(l));

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await submitReport({
        scheme_name: name.trim(),
        // The name is always sent as an identifier, so a reviewer can find
        // everything reported about it. Nothing identifies the reporter.
        identifiers: [
          { type: "name" as IdentifierType, value: name.trim() },
          ...cleanRows.map((r) => ({ type: r.type, value: r.value.trim() })),
        ].slice(0, 10),
        evidence_urls: cleanLinks.slice(0, 5),
      });
      setDone(res.message);
    } catch (err) {
      setError(
        err instanceof QwenchError ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-safe/30 bg-safe/5 p-6">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-5 h-5 text-safe" aria-hidden />
          <h2 className="font-bold text-text-primary">Report received</h2>
        </div>
        <p className="text-sm text-text-secondary">{done}</p>
        <p className="text-sm text-text-secondary mt-3">
          Nothing on this site changes yet. If a reviewer finds something checkable,
          a second reviewer has to agree before it appears in a result.
        </p>
        <p className="text-sm text-text-secondary mt-3">
          If money is at risk right now, call{" "}
          {HOTLINES.map((h, i) => (
            <span key={h.name}>
              {i > 0 && " or "}
              {h.name} on <span className="font-semibold text-text-primary">{h.number}</span>
            </span>
          ))}
          .
        </p>
        <div className="flex flex-wrap gap-3 mt-5">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-primary hover:brightness-110 transition-all min-h-[44px]"
          >
            Back to home
          </Link>
          <button
            onClick={() => {
              setDone(null);
              setStep(1);
              setName("");
              setRows([{ type: "domain", value: "" }]);
              setLinks([""]);
            }}
            className="inline-flex items-center justify-center rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-alt transition-colors cursor-pointer min-h-[44px]"
          >
            Report another
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <StepProgress currentStep={step} totalSteps={TOTAL_STEPS} />

      {step === 1 && (
        <Step
          title="What is it called?"
          hint="The name on the advert, the website, or the message you were sent. Use the spelling you saw."
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            placeholder="Company or platform name"
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors"
            aria-label="Company or platform name"
          />
        </Step>
      )}

      {step === 2 && (
        <Step
          title="How did they reach you?"
          hint="Numbers and handles are stored as one-way hashes, never as readable values. Skip anything you don't have."
        >
          <div className="space-y-3">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <select
                  value={row.type}
                  onChange={(e) =>
                    setRows(rows.map((r, j) => (j === i ? { ...r, type: e.target.value as IdentifierType } : r)))
                  }
                  className="rounded-lg border border-border bg-surface px-3 py-3 text-sm text-text-primary outline-none focus:border-accent cursor-pointer min-h-[44px]"
                  aria-label="What kind of detail is this?"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  value={row.value}
                  onChange={(e) =>
                    setRows(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                  }
                  maxLength={500}
                  placeholder={TYPES.find((t) => t.value === row.type)?.placeholder}
                  className="flex-1 min-w-0 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors"
                  aria-label="Value"
                />
                {rows.length > 1 && (
                  <button
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                    className="p-2 text-text-muted hover:text-danger transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Remove this line"
                  >
                    <X className="w-4 h-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            {rows.length < 9 && (
              <button
                onClick={() => setRows([...rows, { type: "domain", value: "" }])}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline cursor-pointer min-h-[44px]"
              >
                <Plus className="w-4 h-4" aria-hidden />
                Add another
              </button>
            )}
          </div>
        </Step>
      )}

      {step === 3 && (
        <Step
          title="Anything a reviewer can open?"
          hint="A link to their website, the advert, the group, or a post. This is the most useful thing you can give us — a reviewer can check a link, and can't check a story."
        >
          <div className="space-y-3">
            {links.map((link, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={link}
                  onChange={(e) => setLinks(links.map((l, j) => (j === i ? e.target.value : l)))}
                  maxLength={2000}
                  inputMode="url"
                  placeholder="https://..."
                  className="flex-1 min-w-0 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors"
                  aria-label={`Evidence link ${i + 1}`}
                />
                {links.length > 1 && (
                  <button
                    onClick={() => setLinks(links.filter((_, j) => j !== i))}
                    className="p-2 text-text-muted hover:text-danger transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Remove this link"
                  >
                    <X className="w-4 h-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            {links.length < 5 && (
              <button
                onClick={() => setLinks([...links, ""])}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline cursor-pointer min-h-[44px]"
              >
                <Plus className="w-4 h-4" aria-hidden />
                Add another link
              </button>
            )}
            {badLinks.length > 0 && (
              <p className="text-xs text-danger">
                A link needs to start with http:// or https:// — otherwise a reviewer
                can&apos;t open it.
              </p>
            )}
            <p className="text-xs text-text-muted pt-2">
              Qwench has nowhere to file a written account, so there is no box for one
              here. If you need to tell someone what happened, call SEC Ghana on 0800
              100 065.
            </p>
          </div>
        </Step>
      )}

      {step === 4 && (
        <Step title="Ready to send?" hint="Check it over. Nothing here identifies you.">
          <dl className="rounded-xl border border-border bg-surface divide-y divide-border">
            <Row label="Name">{name.trim() || "—"}</Row>
            <Row label="Details">
              {cleanRows.length
                ? cleanRows
                    .map((r) => `${TYPES.find((t) => t.value === r.type)?.label}: ${r.value.trim()}`)
                    .join(" · ")
                : "None given"}
            </Row>
            <Row label="Links">
              {cleanLinks.length ? (
                <span className="break-all">{cleanLinks.join(" · ")}</span>
              ) : (
                "None given"
              )}
            </Row>
          </dl>

          {error && (
            <p className="flex items-start gap-2 text-sm text-danger mt-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
              {error}
            </p>
          )}
        </Step>
      )}

      <div className="flex justify-between gap-3 mt-8">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : (
          <div />
        )}
        {step < TOTAL_STEPS ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={(step === 1 && !name.trim()) || (step === 3 && badLinks.length > 0)}
            className="disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </Button>
        ) : (
          <Button onClick={send} disabled={sending || !name.trim()} className="disabled:opacity-40">
            {sending ? "Sending…" : "Submit report"}
          </Button>
        )}
      </div>
    </>
  );
}

function Step({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-bold text-text-primary mb-1">{title}</h2>
      <p className="text-sm text-text-secondary mb-5">{hint}</p>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="text-sm text-text-primary mt-1">{children}</dd>
    </div>
  );
}

export default function ReportSchemePage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold text-text-primary mb-2">Submit a report</h1>
      <p className="text-sm text-text-secondary mb-5">
        Tell us about something you were offered. A report doesn&apos;t change what this
        site says — it opens a review by a person.
      </p>

      <p className="inline-flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/30 px-3 py-2 text-xs font-semibold text-text-secondary mb-8">
        <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0" aria-hidden />
        Your identity stays anonymous. We never ask for your name or number.
      </p>

      <Suspense fallback={<div className="h-64 rounded-xl bg-surface-alt animate-pulse" />}>
        <ReportForm />
      </Suspense>
    </div>
  );
}
