import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { cacheLife } from "next/cache";
import { Ban, Database, Phone, ShieldCheck } from "lucide-react";
import { about, HOTLINES } from "@/lib/qwench";
import { WHAT_WE_DO_NOT_DO } from "@/lib/content";

export const metadata: Metadata = {
  title: "About Qwench — where the data comes from",
  description:
    "What Qwench checks, which official sources it uses, and what it deliberately does not do.",
};

async function load() {
  "use cache";
  cacheLife("hours");
  try {
    return await about();
  } catch {
    return null;
  }
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-text-primary mb-3">About Qwench</h1>
      <p className="text-text-secondary leading-relaxed">
        Qwench is Ghana&apos;s fraud bureau. Before money moves, you can check who is
        on the other end against what regulators have actually published. We show you
        the record, who published it, when, and a link to the original — and then the
        decision is yours.
      </p>

      <Section icon={ShieldCheck} title="What a result tells you">
        <p className="text-text-secondary leading-relaxed">
          Every check comes back with a legal state: named in a notice, on a licence
          register, in the regulatory sandbox, in records but not licensed, a regulator
          or public body, or no record at all. Those are facts about paperwork, not
          judgements about people.
        </p>
        <p className="text-text-secondary leading-relaxed mt-3">
          Alongside it you get an evidence level, which says how much there is to go on
          and where it came from. It grades the evidence, never the scheme. There is no
          score anywhere on this site, and no colour that means &ldquo;risky&rdquo;.
        </p>
        <p className="text-text-secondary leading-relaxed mt-3">
          No record found is the most common result, and the easiest to misread. It
          means nothing has been published that we could match. It does not mean it is
          safe or unsafe.
        </p>
      </Section>

      <Section icon={Database} title="Where the data comes from">
        <p className="text-text-secondary leading-relaxed mb-5">
          Public notices, licence registers and sandbox lists published by Ghana&apos;s
          regulators, plus reports from the public that a person has reviewed. Notices
          are collected on a schedule, and a person approves every record before it can
          appear in a result. Two people have to agree: whoever captured a record cannot
          be the one who approves it.
        </p>
        <Suspense fallback={<div className="h-32 rounded-xl bg-surface-alt animate-pulse" />}>
          <Sources />
        </Suspense>
      </Section>

      <Section icon={Ban} title="What we don't do">
        <ul className="space-y-3">
          {WHAT_WE_DO_NOT_DO.map((line) => (
            <li key={line} className="flex gap-3 text-text-secondary">
              <span className="text-danger font-bold flex-shrink-0" aria-hidden>
                ✕
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-text-muted mt-5">
          AI has a narrow job here: it reads screenshots and linked pages so their text
          can be checked by the same rules as anything else. It never decides a state,
          a level, or the wording of a result, and every check works without it.
        </p>
      </Section>

      <Section icon={Phone} title="If something has gone wrong">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {HOTLINES.map((h) => (
            <a
              key={h.name}
              href={h.href}
              className="rounded-xl border border-border bg-surface p-5 hover:border-accent transition-colors"
            >
              <p className="text-sm text-text-secondary">{h.name}</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{h.number}</p>
            </a>
          ))}
        </div>
        <p className="text-sm text-text-secondary mt-5">
          If you think something we show about you is wrong,{" "}
          <Link href="/appeal" className="text-accent font-medium hover:underline">
            submit an appeal
          </Link>
          . A person reads every one.
        </p>
      </Section>
    </div>
  );
}

async function Sources() {
  const data = await load();

  if (!data) {
    return (
      <p className="text-sm text-text-muted">
        The source list couldn&apos;t be loaded just now.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-alt">
            <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wide text-text-muted">
              Publisher
            </th>
            <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide text-text-muted">
              Reviewed records
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.records_by_source.map((s) => (
            <tr key={s.publisher}>
              <td className="px-4 py-3 text-text-primary font-medium">{s.publisher}</td>
              <td className="px-4 py-3 text-right text-text-secondary tabular-nums">
                {s.records.toLocaleString()}
              </td>
            </tr>
          ))}
          <tr className="bg-surface-alt">
            <td className="px-4 py-3 font-bold text-text-primary">Total</td>
            <td className="px-4 py-3 text-right font-bold text-text-primary tabular-nums">
              {data.total_records.toLocaleString()}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="px-4 py-3 text-xs text-text-muted border-t border-border">
        Data as of {data.data_date ?? "—"}. Demo records and partner data are not
        counted here, and never appear in a public result.
      </p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Database;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-accent" aria-hidden />
        <h2 className="text-xl font-bold text-text-primary">{title}</h2>
      </div>
      {children}
    </section>
  );
}
