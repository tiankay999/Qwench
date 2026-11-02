"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Scale } from "lucide-react";
import { submitAppeal, QwenchError, type IdentifierType } from "@/lib/qwench";
import { Button } from "@/components/ui/Button";

/**
 * Appealing a listing.
 *
 * The reply answers only about what Qwench shows publicly. It never confirms or
 * denies whether Qwench holds anything else — internal reports, partner data or
 * signals — because a reply that did would make "no record" a tell
 * (docs/spec/README.md, rules 15 and the appeals decision).
 */
const TYPES: { value: IdentifierType; label: string }[] = [
  { value: "name", label: "A company or platform name" },
  { value: "domain", label: "A website" },
  { value: "momo_number", label: "A MoMo number" },
  { value: "bank_account", label: "A bank account" },
  { value: "wallet", label: "A crypto wallet" },
  { value: "social_handle", label: "A social handle" },
  { value: "merchant_id", label: "A merchant ID" },
];

export default function AppealPage() {
  const [type, setType] = useState<IdentifierType>("name");
  const [value, setValue] = useState("");
  const [contact, setContact] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; due_date: string; message: string } | null>(
    null,
  );

  const ready = value.trim() && contact.trim() && reason.trim();

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSending(true);
    setError(null);
    try {
      setDone(
        await submitAppeal({
          type,
          value: value.trim(),
          contact: contact.trim(),
          reason: reason.trim(),
        }),
      );
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
      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="rounded-xl border border-safe/30 bg-safe/5 p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-safe" aria-hidden />
            <h1 className="font-bold text-text-primary">Appeal received</h1>
          </div>
          <p className="text-sm text-text-secondary">{done.message}</p>
          <dl className="mt-5 rounded-lg border border-border bg-surface divide-y divide-border">
            <div className="px-4 py-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-text-muted">
                Reference
              </dt>
              <dd className="text-sm font-mono text-text-primary mt-1 break-all">
                {done.reference}
              </dd>
            </div>
            <div className="px-4 py-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-text-muted">
                Reply due by
              </dt>
              <dd className="text-sm text-text-primary mt-1">{done.due_date}</dd>
            </div>
          </dl>
          <p className="text-xs text-text-muted mt-4">
            Keep the reference. The reply will cover what Qwench shows publicly about
            this identifier, and nothing else.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center mt-5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-primary hover:brightness-110 transition-all min-h-[44px]"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="flex items-center gap-2 mb-2">
        <Scale className="w-5 h-5 text-accent" aria-hidden />
        <h1 className="text-2xl font-bold text-text-primary">Appeal a listing</h1>
      </div>
      <p className="text-sm text-text-secondary mb-8">
        If you believe what Qwench shows about your company, number or website is
        wrong, tell us. A person reads every appeal and replies about what is shown
        publicly.
      </p>

      <form onSubmit={send} className="space-y-6">
        <Field label="What is being shown?" hint="Pick the kind of thing you are appealing about.">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as IdentifierType)}
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary outline-none focus:border-accent cursor-pointer min-h-[44px]"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Which one?" hint="The exact name, number, website or wallet.">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={500}
            required
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors"
          />
        </Field>

        <Field
          label="How should we reply?"
          hint="An email address or phone number we can use to reach you about this appeal."
        >
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={200}
            required
            placeholder="you@company.com"
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors"
          />
        </Field>

        <Field
          label="Why is it wrong?"
          hint="Point us at anything we can check — a licence number, a register entry, a withdrawal of a notice, your own website."
        >
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
            required
            rows={6}
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors resize-y"
          />
          <span className="block text-xs text-text-muted mt-2">{reason.length}/2000</span>
        </Field>

        {error && (
          <p className="flex items-start gap-2 text-sm text-danger">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={!ready || sending}
          className="w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? "Sending…" : "Submit appeal"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block font-semibold text-text-primary text-sm mb-1">{label}</span>
      <span className="block text-xs text-text-secondary mb-2">{hint}</span>
      {children}
    </label>
  );
}
