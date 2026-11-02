"use client";

import { Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DemoTag, EmptyState, ErrorNote, Field, Loading, PageHeader, Button, inputClass } from "@/components/console/ui";
import { ConsoleError, STATE_LABEL, api, formatDate, type Feed, type FeedRecord } from "@/lib/console";

const CHANGE_LABEL = { added: "Added", updated: "Updated", removed: "Removed" };

const query = (since: string, cursor?: string, format?: string) => {
  const params = new URLSearchParams();
  if (since) params.set("since", new Date(since).toISOString());
  if (cursor) params.set("cursor", cursor);
  if (format) params.set("format", format);
  const text = params.toString();
  return text ? `?${text}` : "";
};

export default function FeedPage() {
  const [since, setSince] = useState("");
  const [change, setChange] = useState("all");
  const [state, setState] = useState("all");
  const [records, setRecords] = useState<FeedRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    (fromDate: string, next?: string) =>
      api<Feed>(`/feed${query(fromDate, next)}`)
        .then((feed) => {
          setError("");
          setRecords((current) => (next ? [...current, ...feed.records] : feed.records));
          setCursor(feed.next_cursor);
        })
        .catch((err) => setError(err instanceof ConsoleError ? err.message : "That didn't work. Try again."))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    load(since);
  }, [load, since]);

  const shown = useMemo(() => records.filter((r) => (change === "all" || r.change === change) && (state === "all" || r.state === state)), [records, change, state]);
  const states = useMemo(() => [...new Set(records.map((r) => r.state))], [records]);

  return (
    <>
      <PageHeader title="Daily feed" intro="New, changed and removed reviewed records, with the identifiers published in them. Partner numbers are never in the feed: check those with a lookup." />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="w-44">
          <Field label="Changed since" htmlFor="since">
            <input
              id="since"
              type="date"
              value={since}
              onChange={(e) => {
                setLoading(true);
                setSince(e.target.value);
              }}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="w-40">
          <Field label="Change" htmlFor="change">
            <select id="change" value={change} onChange={(e) => setChange(e.target.value)} className={inputClass}>
              <option value="all">All</option>
              <option value="added">Added</option>
              <option value="updated">Updated</option>
              <option value="removed">Removed</option>
            </select>
          </Field>
        </div>
        <div className="w-52">
          <Field label="State" htmlFor="state">
            <select id="state" value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
              <option value="all">All</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {STATE_LABEL[s] || s}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <a
          href={`/v1/console/feed${query(since, undefined, "csv")}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-text-primary hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-mid-navy"
        >
          <Download aria-hidden className="size-4" />
          Download CSV
        </a>
        <a
          href={`/v1/console/feed${query(since)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-text-primary hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-mid-navy"
        >
          Open JSON
        </a>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !records.length && <Loading label="Loading the feed" />}

      {!loading && !error && !shown.length && (
        <EmptyState title={records.length ? "No records match these filters." : "No reviewed records yet."}>
          {records.length ? "Try changing a filter." : "Records appear here once they've been reviewed by a second person."}
        </EmptyState>
      )}

      {shown.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b border-border text-xs text-text-secondary">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Change</th>
                <th scope="col" className="px-4 py-3 font-medium">Entity</th>
                <th scope="col" className="px-4 py-3 font-medium">State</th>
                <th scope="col" className="px-4 py-3 font-medium">Source</th>
                <th scope="col" className="px-4 py-3 font-medium">Identifiers</th>
                <th scope="col" className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((record, index) => (
                <tr key={`${record.entity}-${record.updated_at}-${index}`} className="align-top text-text-primary">
                  <td className="px-4 py-3 whitespace-nowrap">{CHANGE_LABEL[record.change]}</td>
                  <td className="px-4 py-3 font-medium">
                    {record.entity}
                    {record.is_demo && (
                      <span className="ml-2">
                        <DemoTag />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{STATE_LABEL[record.state] || record.state}</td>
                  <td className="px-4 py-3">
                    {record.source.url ? (
                      <a href={record.source.url} target="_blank" rel="noreferrer" className="text-mid-navy underline dark:text-accent">
                        {record.source.publisher}
                      </a>
                    ) : (
                      record.source.publisher
                    )}
                    <div className="text-xs text-text-secondary">{formatDate(record.source.date)}</div>
                  </td>
                  <td className="px-4 py-3 break-all">{record.identifiers.length ? record.identifiers.map((i) => i.value).join(", ") : <span className="text-text-secondary">None published</span>}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(record.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cursor && (
        <div className="mt-4">
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              load(since, cursor);
            }}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </>
  );
}
