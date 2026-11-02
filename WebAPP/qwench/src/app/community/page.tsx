import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, FileSearch, Phone, Plus, Users } from "lucide-react";
import { HOTLINES } from "@/lib/qwench";

export const metadata: Metadata = {
  title: "Reports and reviews — Qwench",
  description:
    "What happens to a report, why Qwench doesn't publish a feed of them, and how to send one.",
};

/**
 * The prototype had a live feed of other people's reports, with names, risk
 * labels and upvotes. None of that can exist here.
 *
 * A report never changes a public result on its own — it opens a review (rule
 * 5) — and a public reply may reveal only regulator records, legal states and
 * reviewed impersonation (rule 15). Publishing an unreviewed report would be
 * both: an accusation nobody checked, and a leak of what Qwench holds. So this
 * page explains the pipeline instead of faking its output.
 *
 * If a public endpoint for reviewed, published records is ever added, a real
 * feed belongs here. That is the backend owner's call.
 */
const PIPELINE = [
  {
    icon: Plus,
    title: "You send it",
    desc: "A name, anything that identifies them, and links a reviewer can open. We never ask who you are, and the form has no field for your number.",
  },
  {
    icon: FileSearch,
    title: "A person reads it",
    desc: "Someone at Qwench looks for something checkable — a published notice, a register entry, a page that is still up — and captures a record with the source and the date.",
  },
  {
    icon: Users,
    title: "A second person agrees",
    desc: "Whoever captured the record cannot approve it. A different reviewer has to agree, and an active record needs wording quoted from the source.",
  },
  {
    icon: EyeOff,
    title: "Only then does it show",
    desc: "Once both have signed off, the record appears in every check — on this site, on WhatsApp, on Telegram and in the institutional feed, at the same time.",
  },
];

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-text-primary mb-3">Reports and reviews</h1>
      <p className="text-text-secondary leading-relaxed">
        The most useful thing you can send Qwench is something a reviewer can open. Here
        is exactly what happens to it, and why you won&apos;t find a feed of other
        people&apos;s reports on this page.
      </p>

      <Link
        href="/report-scheme"
        className="inline-flex items-center gap-2 mt-6 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-primary hover:brightness-110 transition-all min-h-[44px]"
      >
        <Plus className="w-4 h-4" aria-hidden />
        Submit a report
      </Link>

      <section className="mt-14">
        <h2 className="text-xl font-bold text-text-primary mb-6">What happens to a report</h2>
        <ol className="space-y-4">
          {PIPELINE.map((step, i) => (
            <li key={step.title} className="rounded-xl border border-border bg-surface p-5 flex gap-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <step.icon className="w-5 h-5 text-accent" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-text-muted mb-1">
                  Step {i + 1}
                </p>
                <h3 className="font-bold text-text-primary mb-1">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-bold text-text-primary mb-4">
          Why there is no feed of reports here
        </h2>
        <div className="rounded-xl border border-border bg-surface-alt p-6 space-y-4 text-text-secondary leading-relaxed">
          <p>
            A report that nobody has checked is an accusation. Published as-is, with a
            company name attached, it would do real damage to anyone reported by mistake
            — and it would be trivial to abuse, because anyone can send one.
          </p>
          <p>
            It would also give away what Qwench holds. A result has to look the same
            whether or not there is an unreviewed report behind it, otherwise
            &ldquo;no record&rdquo; becomes a signal in itself.
          </p>
          <p>
            So reports do one thing: they open a review. What you can see publicly is
            what two people have signed off on, and every one of those carries the
            publisher, the date and a link to the original.
          </p>
        </div>
        <Link
          href="/about"
          className="inline-block mt-4 text-sm font-semibold text-accent hover:underline"
        >
          What Qwench can and can&apos;t show →
        </Link>
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-bold text-text-primary mb-4">If money is at risk now</h2>
        <p className="text-text-secondary mb-5">
          A report to Qwench opens a review, which takes time. If something is happening
          right now, call one of these instead.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {HOTLINES.map((h) => (
            <a
              key={h.name}
              href={h.href}
              className="rounded-xl border border-border bg-surface p-5 hover:border-accent transition-colors"
            >
              <p className="inline-flex items-center gap-2 text-sm text-text-secondary">
                <Phone className="w-3.5 h-3.5" aria-hidden />
                {h.name}
              </p>
              <p className="text-2xl font-bold text-text-primary mt-1">{h.number}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
