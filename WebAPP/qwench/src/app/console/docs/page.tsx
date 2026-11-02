import { PageHeader, Panel } from "@/components/console/ui";

export const instant = false;

const CHECK = `curl -X POST https://YOUR-QWENCH-API/v1/check \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $QWENCH_API_KEY" \\
  -d '{"recipient": "+233240000000", "type": "momo_number", "amount_ghs": 800, "new_payee": true}'`;

const REPLY = `{
  "match": true,
  "entity": "Example Scheme",
  "state": "named_in_notice",
  "tier": 1,
  "reason_codes": ["REGULATOR_NOTICE"],
  "sources": [{ "publisher": "", "date": "", "url": "" }],
  "allowed_use": "customer_warning",
  "suggested_action": "warn",
  "is_demo": false,
  "checked_at": ""
}`;

const FEED = `curl "https://YOUR-QWENCH-API/v1/feed?since=2026-11-01T00:00:00Z&format=csv" \\
  -H "x-api-key: $QWENCH_API_KEY"`;

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-lg bg-surface-alt p-3 text-xs leading-relaxed text-text-primary">{children}</pre>;
}

const ROWS = [
  ["warn_or_confirmation_call", "Tier 1, a new payee, and an amount at or above your limit"],
  ["warn", "Other tier 1 results, and anything else you may show customers"],
  ["internal_review", "Tiers 2 and 3, kept inside your organisation"],
  ["watch", "Tier 4"],
  ["none", "Everything else, including no record"],
];

export default function DocsPage() {
  return (
    <>
      <PageHeader title="API docs" intro="Connect your payment flow. Call the API from your servers only, and keep keys out of browsers and apps." />
      <div className="space-y-6">
        <Panel title="Check a payee">
          <p className="mb-3 text-sm text-text-secondary">Needs a key with the check scope. Qwench answers in the request and never blocks or holds a payment: what happens next is up to you.</p>
          <Code>{CHECK}</Code>
          <p className="mt-4 mb-2 text-sm font-medium text-text-primary">Reply</p>
          <Code>{REPLY}</Code>
        </Panel>

        <Panel title="Suggested actions">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <tbody className="divide-y divide-border">
                {ROWS.map(([code, meaning]) => (
                  <tr key={code}>
                    <th scope="row" className="py-2 pr-4 font-mono text-xs font-medium text-text-primary">{code}</th>
                    <td className="py-2 text-text-secondary">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Daily feed">
          <p className="mb-3 text-sm text-text-secondary">Needs a key with the feed scope. Records say whether they were added, updated or removed. Follow next_cursor for more pages. Partner numbers are never in the feed, so check those with the call above.</p>
          <Code>{FEED}</Code>
        </Panel>

        <Panel title="Errors">
          <p className="text-sm text-text-secondary">A missing or revoked key gets 401, a key without the scope gets 403, and too many requests get 429. Every error has this shape:</p>
          <div className="mt-3">
            <Code>{`{ "error": { "code": "...", "message": "..." } }`}</Code>
          </div>
        </Panel>
      </div>
    </>
  );
}
