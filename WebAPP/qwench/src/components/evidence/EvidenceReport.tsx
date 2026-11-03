import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  Info,
  Landmark,
  Link2,
  Percent,
  Search,
  Sparkles,
} from "lucide-react";
import type { CheckResult } from "@/lib/qwench";
import { StateBadge } from "./StateBadge";
import { EvidenceLevelBlock } from "./EvidenceLevel";

/**
 * One check result, laid out.
 *
 * The order matches the bot's reply (WhatsappBot/src/core/reply.js) on purpose:
 * what this is, who published it, what was promised, what was found, what to
 * ask, then the footer. Someone who checks the same name on WhatsApp and here
 * should recognise the second answer as the same answer.
 *
 * Every sentence below comes from `result.report`. This file adds headings and
 * icons and nothing else — no summary, no conclusion, no score.
 */
export function EvidenceReport({
  result,
  query,
  compact = false,
}: {
  result: CheckResult;
  query?: string;
  compact?: boolean;
}) {
  const r = result.report;
  const title = result.entity || query || "This check";
  const aiSigns = r.ai_warning_signs ?? [];

  return (
    <article className="space-y-6">
      {/* 1. What this is ------------------------------------------------ */}
      <header>
        <p className="text-xs font-bold uppercase tracking-wide text-text-muted mb-2">
          Check result
        </p>
        <h1
          className={
            compact
              ? "text-xl font-extrabold text-text-primary mb-3"
              : "text-2xl md:text-3xl font-extrabold text-text-primary mb-3"
          }
        >
          {title}
        </h1>
        <StateBadge state={result.state} size="lg" />
        <p className="text-base text-text-primary mt-4 leading-relaxed">{r.state_sentence}</p>
        {result.is_demo && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-signs-tint px-3 py-2 text-xs font-semibold text-signs-ink">
            🧪 Includes demo data — not a real institution&apos;s record.
          </p>
        )}
      </header>

      <EvidenceLevelBlock level={r.evidence_level} tier={result.tier} />

      {/* 2. Who published it -------------------------------------------- */}
      {r.sources.length > 0 && (
        <Section icon={FileText} title="Sources">
          <ul className="space-y-4">
            {r.sources.map((s, i) => (
              <li key={`${s.publisher}-${i}`} className="rounded-xl border border-border bg-surface p-4">
                <p className="font-semibold text-text-primary">{s.publisher}</p>
                {s.title && <p className="text-sm text-text-secondary mt-0.5">{s.title}</p>}
                {s.quote && (
                  <blockquote className="border-l-2 border-accent pl-3 mt-3 text-sm italic text-text-secondary">
                    {s.quote}
                  </blockquote>
                )}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-xs text-text-muted">
                  {s.date && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" aria-hidden />
                      Published {s.date}
                    </span>
                  )}
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-accent font-medium hover:underline break-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                      {s.url}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 3. What was promised -------------------------------------------- */}
      {r.return_check && (
        <Section icon={Percent} title="Return check">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-lg font-bold text-text-primary">{r.return_check.stated}</p>
            <p className="text-sm text-text-secondary mt-1">{r.return_check.note}</p>
          </div>
        </Section>
      )}

      {/* 4. What was found ----------------------------------------------- */}
      {r.warning_signs.length > 0 && (
        <Section icon={AlertTriangle} title="What we found in the wording">
          <Bullets items={r.warning_signs} />
        </Section>
      )}

      {aiSigns.length > 0 && (
        <Section icon={Sparkles} title="Signs an AI reader spotted">
          <p className="text-xs text-text-muted mb-3">
            Read by AI from the text you sent, with its proof checked. These change no
            record and count toward no evidence level.
          </p>
          <Bullets items={aiSigns} />
        </Section>
      )}

      {r.link_facts.length > 0 && (
        <Section icon={Link2} title="About the link">
          <Bullets items={r.link_facts} />
        </Section>
      )}

      {/* What a Ghana authority has already published about this kind of
          message. Their wording, their date, their link — the reader can hold
          the message up against the official description themselves. It is not
          a finding about the sender and it changes no evidence level. */}
      {r.advisories?.length > 0 &&
        r.advisories.map((a) => (
          <Section key={a.url} icon={Landmark} title={a.topic}>
            <p className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm">
              <span className="font-semibold text-text-secondary">{a.publisher}</span>
              {a.date && <time className="tabular font-mono text-text-muted">{a.date}</time>}
            </p>
            <Bullets items={a.points} />
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent underline underline-offset-[3px] hover:decoration-2"
            >
              Read it on {new URL(a.url).hostname}
              <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden />
            </a>
          </Section>
        ))}

      {r.foreign_context.length > 0 && (
        <Section icon={Globe} title="Context from outside Ghana">
          <Bullets items={r.foreign_context} />
        </Section>
      )}

      {r.also_checked.length > 0 && (
        <Section icon={Search} title="Also checked in this message">
          <Bullets items={r.also_checked} />
        </Section>
      )}

      {r.notes.length > 0 && (
        <Section icon={Info} title="Notes">
          <Bullets items={r.notes} />
        </Section>
      )}

      {/* 5. Questions to ask ---------------------------------------------- */}
      {r.questions_to_ask.length > 0 && (
        <Section icon={HelpCircle} title="Questions to ask">
          <ul className="space-y-3">
            {r.questions_to_ask.map((q) => (
              <li
                key={q}
                className="rounded-xl border border-border bg-surface p-4 text-sm text-text-primary"
              >
                {q}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Nothing on file: offer the one useful next step. ------------------ */}
      {result.state === "no_record" && (
        <div className="rounded-xl border border-border bg-surface-alt p-5">
          <p className="text-sm text-text-secondary">
            Know something about this one? A report doesn&apos;t change what this page
            says — it opens a review by a person.
          </p>
          <Link
            href={`/report-scheme${result.entity || query ? `?name=${encodeURIComponent(result.entity || query || "")}` : ""}`}
            className="inline-flex items-center justify-center mt-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-bright transition-colors min-h-[44px]"
          >
            Submit a report
          </Link>
        </div>
      )}

      {/* 6. Footer --------------------------------------------------------- */}
      <footer className="border-t border-border pt-5 space-y-3">
        <p className="text-sm text-text-secondary italic">{r.disclaimer}</p>
        <p className="text-xs text-text-muted">{r.footer}</p>
        <Link href="/appeal" className="inline-block text-xs font-semibold text-accent hover:underline">
          Think this is wrong? Appeal it →
        </Link>
      </footer>
    </article>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FileText;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-accent" aria-hidden />
        <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={`${i}-${item.slice(0, 24)}`} className="flex gap-3 text-sm text-text-secondary">
          <span className="text-accent font-bold flex-shrink-0" aria-hidden>
            •
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
