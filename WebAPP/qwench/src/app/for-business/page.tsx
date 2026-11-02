import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Landmark, Plug, Terminal } from "lucide-react";

export const metadata: Metadata = {
  title: "Qwench for banks and MoMo apps",
  description:
    "Know Your Payee: check a recipient against published regulator records before a payment leaves.",
};

/**
 * For institutions.
 *
 * The endpoint list is the real one (Backend/src/routes/institutional.js). The
 * page never implies that any bank, MoMo operator or regulator is already a
 * partner — they are prospects (docs/spec/README.md, rule 14).
 */
const ENDPOINTS = [
  {
    method: "POST",
    path: "/v1/check",
    scope: "check",
    desc: "One recipient — a name, a MoMo number, a bank account — against reviewed records. Numbers are matched as keyed hashes; nothing readable is sent back.",
  },
  {
    method: "GET",
    path: "/v1/feed",
    scope: "feed",
    desc: "Reviewed regulator records and the identifiers published in them, as JSON or CSV, since a timestamp you keep. Partner data is never in it.",
  },
  {
    method: "POST",
    path: "/v1/contributions",
    scope: "contributions",
    desc: "Send what your fraud team has confirmed. It opens a review; it never changes a public result on its own.",
  },
  {
    method: "GET",
    path: "/v1/signals",
    scope: "signals",
    desc: "Reviewed rises in checks. For watching, not for warning a customer.",
  },
  {
    method: "GET",
    path: "/v1/cases/:id",
    scope: "cases",
    desc: "An evidence pack for a case, ready to hand to the authorities.",
  },
  {
    method: "POST",
    path: "/v1/merchants/verify-number",
    scope: "merchants",
    desc: "Whether a number is registered to a business in the merchant registry. It shows who controls the number, and nothing more.",
  },
];

export default function ForBusinessPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center gap-2 mb-3">
        <Landmark className="w-5 h-5 text-accent" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-wide text-accent">
          For banks and MoMo apps
        </p>
      </div>
      <h1 className="text-3xl font-extrabold text-text-primary mb-4">Know Your Payee</h1>
      <p className="text-text-secondary leading-relaxed max-w-2xl">
        Before a payment goes, check the recipient against schemes regulators have named
        and fraud teams have confirmed. Qwench returns the record, the publisher, the
        date and what your institution is allowed to do with it. It never blocks a
        payment, holds money, or contacts anyone — those stay yours.
      </p>

      <section className="mt-12">
        <div className="flex items-center gap-2 mb-5">
          <Plug className="w-5 h-5 text-accent" aria-hidden />
          <h2 className="text-xl font-bold text-text-primary">The endpoints</h2>
        </div>
        <div className="space-y-3">
          {ENDPOINTS.map((e) => (
            <div key={e.path} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="rounded-md bg-accent/10 px-2 py-1 font-mono text-xs font-bold text-accent">
                  {e.method}
                </span>
                <code className="font-mono text-sm font-semibold text-text-primary break-all">
                  {e.path}
                </code>
                <span className="text-xs text-text-muted">
                  scope <code className="font-mono">{e.scope}</code>
                </span>
              </div>
              <p className="text-sm text-text-secondary">{e.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-center gap-2 mb-5">
          <KeyRound className="w-5 h-5 text-accent" aria-hidden />
          <h2 className="text-xl font-bold text-text-primary">Getting a key</h2>
        </div>
        <ol className="space-y-4">
          {[
            "Tell us which scopes your team needs and who will hold the key.",
            "We create your organisation and a console login. Keys are issued in the console, stored as a keyed hash, and shown once.",
            "Send the key as the x-api-key header. Each key has its own per-minute allowance and can be revoked without affecting the others.",
          ].map((step, i) => (
            <li key={step} className="flex gap-4">
              <span className="w-8 h-8 rounded-full bg-accent/10 text-accent font-bold text-sm flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <p className="text-text-secondary pt-1.5">{step}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-xl border border-border bg-surface-alt p-6">
          <h3 className="font-bold text-text-primary mb-2">Talk to us</h3>
          <p className="text-sm text-text-secondary mb-5">
            Qwench is pre-launch. Banks, MoMo operators and regulators we have spoken to
            are prospects, not partners, and we say so everywhere. If your institution
            wants to try Know Your Payee, we will set up a sandbox organisation with demo
            data so nothing real is at stake.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:hello@qwench.gh?subject=API%20access"
              className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-bright transition-colors min-h-[44px]"
            >
              Request API access
            </a>
            <Link
              href="/console"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface transition-colors min-h-[44px]"
            >
              <Terminal className="w-4 h-4" aria-hidden />
              Partner console
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
