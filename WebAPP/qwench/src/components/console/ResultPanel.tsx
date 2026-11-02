"use client";

import { ACTION_LABEL, REASON_LABEL, STATE_LABEL, TIER_LABEL, USE_LABEL, type CheckResult, type Source } from "@/lib/console";
import { DemoTag, Facts, Panel, Tag } from "./ui";

export function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) return <p className="text-sm text-text-secondary">No published source.</p>;
  return (
    <ul className="space-y-3">
      {sources.map((source, index) => (
        <li key={`${source.publisher}-${index}`} className="text-sm">
          <p className="font-medium text-text-primary">
            {source.publisher}
            {source.date ? `, ${source.date}` : ""}
          </p>
          {source.title && <p className="text-text-secondary">{source.title}</p>}
          {source.quote && <blockquote className="mt-1 border-l-2 border-border pl-3 text-text-secondary">{source.quote}</blockquote>}
          {source.url && (
            <a href={source.url} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-mid-navy underline dark:text-accent">
              Open the source
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Everything institutions see for one check. All wording about the finding comes from the API. */
export function ResultPanel({ result, showMembers }: { result: CheckResult; showMembers?: boolean }) {
  const { report } = result;

  return (
    <div className="space-y-4" aria-live="polite">
      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Tag>{STATE_LABEL[result.state] || result.state}</Tag>
          {result.tier !== null && <Tag>{TIER_LABEL[result.tier]}</Tag>}
          {result.is_demo && <DemoTag />}
        </div>
        <p className="text-lg font-bold text-text-primary">{report.evidence_level.label}</p>
        <p className="mt-1 text-sm text-text-secondary">{report.evidence_level.meaning}</p>
        {result.entity && <h2 className="mt-3 font-semibold text-text-primary">{result.entity}</h2>}
        <p className="mt-1 text-sm text-text-primary">{report.state_sentence}</p>
        {report.foreign_context.map((line) => (
          <p key={line} className="mt-2 text-sm text-text-secondary">
            {line}
          </p>
        ))}
      </Panel>

      <Panel title="What you can do with this">
        <Facts
          items={[
            ["Allowed use", result.allowed_use ? USE_LABEL[result.allowed_use] : "Nothing to act on"],
            ["Suggested action", ACTION_LABEL[result.suggested_action] || result.suggested_action],
            ["Reason", result.reason_codes.length ? result.reason_codes.map((code) => REASON_LABEL[code] || code).join(". ") : "None"],
            ...(showMembers
              ? ([
                  ["Member reports", result.member_report_count ? `Reported by ${result.member_report_count} member${result.member_report_count === 1 ? "" : "s"}` : "No member reports yet."],
                  ["Signal", result.signal ? `${result.signal.checks_this_week} checks this week, ${result.signal.checks_last_week} last week` : "No reviewed signal."],
                ] as [string, React.ReactNode][])
              : []),
          ]}
        />
      </Panel>

      <Panel title="Sources">
        <SourceList sources={result.sources.length ? result.sources : report.sources} />
      </Panel>

      {report.questions_to_ask.length > 0 && (
        <Panel title="Questions to ask">
          <ul className="list-disc space-y-1 pl-5 text-sm text-text-primary">
            {report.questions_to_ask.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="text-xs text-text-secondary">
        {report.disclaimer} {report.footer}
      </p>
    </div>
  );
}
