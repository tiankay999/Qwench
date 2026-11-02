"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConsoleUser } from "@/components/console/ConsoleShell";
import { Button, EmptyState, ErrorNote, Facts, Field, Loading, PageHeader, Tag, inputClass } from "@/components/console/ui";
import { ConsoleError, api, formatDate, type CollectorStatus, type QueueItem } from "@/lib/console";

const KIND_LABEL: Record<QueueItem["kind"], string> = {
  record: "Record",
  relation: "Impersonation or link",
  public_report: "Public report",
  contribution: "Member contribution",
  signal: "Rise in checks",
  notice: "Notice to read",
};

const APPROVE: Record<QueueItem["kind"], { label: string; effect: string }> = {
  record: { label: "Approve record", effect: "This goes live. Public checks and the feed will show it." },
  relation: { label: "Approve link", effect: "If this is an impersonation, public checks will name the business." },
  public_report: { label: "Confirm report", effect: "It's kept and counts as evidence. It doesn't change a public reply." },
  contribution: { label: "Approve contribution", effect: "Members can then see this number confirmed. The public can't." },
  signal: { label: "Approve signal", effect: "Members can then see this at tier 4. The public can't." },
  notice: { label: "Mark as handled", effect: "This closes the notice. Anything in it still needs entering as its own record." },
};

const REJECT: Record<QueueItem["kind"], string> = {
  record: "Withdraw record",
  relation: "Reject link",
  public_report: "Dismiss report",
  contribution: "Reject contribution",
  signal: "Dismiss signal",
  notice: "Not relevant",
};

function details(item: QueueItem): [string, React.ReactNode][] {
  const rows: [string, React.ReactNode][] = [];
  const add = (label: string, value: React.ReactNode) => {
    if (value !== undefined && value !== null && value !== "") rows.push([label, value]);
  };

  add("Type", item.record_type || item.relation_type);
  add("Other names", item.aliases?.length ? item.aliases.join(", ") : undefined);
  add("Why it's here", item.note);
  if (item.url) {
    add(
      "Notice",
      <a href={item.url} target="_blank" rel="noreferrer noopener" className="text-mid-navy underline dark:text-accent">
        Read the notice{item.published_on ? `, ${formatDate(item.published_on)}` : ""}
      </a>,
    );
  }
  add("Websites in it", item.websites?.length ? item.websites.join(", ") : undefined);
  add("Jurisdiction", item.jurisdiction);
  add("From", item.from_entity);
  add("To", item.to_entity);
  add("Quote", item.kind === "record" ? item.quote || "No quote yet. It can't go live without one." : undefined);
  if (item.source) {
    add(
      "Source",
      item.source.url ? (
        <a href={item.source.url} target="_blank" rel="noreferrer" className="text-mid-navy underline dark:text-accent">
          {item.source.publisher}, {formatDate(item.source.date)}
        </a>
      ) : (
        `${item.source.publisher}, ${formatDate(item.source.date)}`
      ),
    );
  }
  add("Channel", item.channel);
  add("Terms", item.terms);
  add("Region", item.region);
  add("Loss range", item.loss_band);
  add("Identifiers", item.identifier_types?.length ? `${item.identifier_types.join(", ")} (hashed)` : undefined);
  if (item.kind === "signal") add("Checks", `${item.checks_this_week} this week, ${item.checks_last_week} last week, from ${item.distinct_sources} sources`);
  if (item.evidence?.length) {
    add(
      "Evidence",
      <ul className="space-y-1">
        {item.evidence.map((link) =>
          /^https?:\/\//.test(link) ? (
            <li key={link}>
              <a href={link} target="_blank" rel="noreferrer noopener" className="break-all text-mid-navy underline dark:text-accent">
                {link}
              </a>
            </li>
          ) : (
            <li key={link}>{link}</li>
          ),
        )}
      </ul>,
    );
  }
  add("Captured by", item.captured_by);
  add("Added", item.created_at ? formatDate(item.created_at) : undefined);
  return rows;
}

function QueueCard({ item, onDecided }: { item: QueueItem; onDecided: () => void }) {
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState("");
  const needsQuote = item.kind === "record" && !item.quote;

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      await api(`/review-queue/${item.id}`, { body: { kind: item.kind, decision, ...(decision === "approve" && needsQuote ? { quote } : {}) } });
      onDecided();
    } catch (err) {
      setError(err instanceof ConsoleError ? err.message : "That didn't work. Try again.");
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tag>{KIND_LABEL[item.kind]}</Tag>
        {item.volume_flag && <Tag>Many reports from one channel</Tag>}
      </div>
      <h2 className="mb-3 font-semibold break-words text-text-primary">{item.title}</h2>
      <Facts items={details(item)} />

      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-4">
        {!item.can_review ? (
          <p className="text-sm text-text-secondary">A different person has to review this, because it came from you or your organisation.</p>
        ) : confirming ? (
          <div>
            <p className="mb-2 text-sm text-text-primary">{confirming === "approve" ? APPROVE[item.kind].effect : "This takes it out of the queue, and it won't go live."}</p>
            {confirming === "approve" && needsQuote && (
              <div className="mb-3">
                <Field label="Exact wording from the original" htmlFor={`quote-${item.id}`} hint="Copy it word for word from the regulator's notice.">
                  <textarea id={`quote-${item.id}`} rows={3} value={quote} onChange={(e) => setQuote(e.target.value)} className={`${inputClass} py-2`} />
                </Field>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || (confirming === "approve" && needsQuote && !quote.trim())} onClick={() => decide(confirming)}>
                {confirming === "approve" ? APPROVE[item.kind].label : REJECT[item.kind]}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setConfirming(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setConfirming("approve")}>{APPROVE[item.kind].label}…</Button>
            <Button variant="secondary" onClick={() => setConfirming("reject")}>
              {REJECT[item.kind]}…
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

export default function ReviewPage() {
  const user = useConsoleUser();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [kind, setKind] = useState<"all" | QueueItem["kind"]>("all");
  const [error, setError] = useState("");
  const [sources, setSources] = useState<CollectorStatus | null>(null);

  const load = useCallback(
    () =>
      api<{ items: QueueItem[] }>("/review-queue")
        .then(({ items: queue }) => setItems(queue))
        .catch((err) => setError(err instanceof ConsoleError ? err.message : "That didn't work. Try again.")),
    [],
  );

  useEffect(() => {
    if (user.role !== "reviewer") return;
    load();
    api<CollectorStatus>("/collectors")
      .then(setSources)
      .catch(() => setSources(null));
  }, [load, user.role]);

  const shown = useMemo(() => (items || []).filter((i) => kind === "all" || i.kind === kind), [items, kind]);
  const kinds = useMemo(() => [...new Set((items || []).map((i) => i.kind))], [items]);

  if (user.role !== "reviewer") return <EmptyState title="Only Qwench's reviewers can use the review queue." />;

  return (
    <>
      <PageHeader title="Review queue" intro="Nothing goes live until a second person approves it. You can't review your own captures, and every decision is logged." />
      {sources && (
        <ul aria-label="Regulator sources" className="mb-4 grid gap-2 sm:grid-cols-2">
          {sources.collectors.map((source) => (
            <li key={source.collector} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
              <p className="font-medium text-text-primary">{source.publisher}</p>
              <p className="text-text-secondary">
                {source.stale ? "Not working: no successful check in the last day." : `Checked ${formatDate(source.last_success_at)}.`}
              </p>
            </li>
          ))}
        </ul>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {!items && !error && <Loading label="Loading the queue" />}
      {items && !items.length && <EmptyState title="Nothing to review.">New records, reports and contributions appear here.</EmptyState>}

      {items && items.length > 0 && (
        <>
          <div role="group" aria-label="Filter by kind" className="mb-4 flex flex-wrap gap-2">
            <Button variant={kind === "all" ? "primary" : "secondary"} aria-pressed={kind === "all"} onClick={() => setKind("all")}>
              All ({items.length})
            </Button>
            {kinds.map((k) => (
              <Button key={k} variant={kind === k ? "primary" : "secondary"} aria-pressed={kind === k} onClick={() => setKind(k)}>
                {KIND_LABEL[k]} ({items.filter((i) => i.kind === k).length})
              </Button>
            ))}
          </div>
          <ul className="space-y-4">
            {shown.map((item) => (
              <QueueCard key={item.id} item={item} onDecided={load} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
