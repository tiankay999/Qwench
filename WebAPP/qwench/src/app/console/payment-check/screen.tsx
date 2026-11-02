"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { IdentifierForm } from "@/components/console/IdentifierForm";
import { ResultPanel } from "@/components/console/ResultPanel";
import { Button, ErrorNote, PageHeader, Panel, Tag } from "@/components/console/ui";
import { ConsoleError, api, type CheckResult } from "@/lib/console";

type Sent = { recipient: string; amount: string };

/** What a bank's own app might show. A mock: Qwench never blocks or holds a payment. */
function MockPaymentScreen({ result, sent }: { result: CheckResult | null; sent: Sent | null }) {
  const warns = result?.allowed_use === "customer_warning";
  const call = result?.suggested_action === "warn_or_confirmation_call";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">Example payment screen</h2>
        <Tag>Mock, not a real app</Tag>
      </div>
      <div className="mx-auto max-w-xs rounded-3xl border border-border bg-surface p-4">
        <p className="text-xs font-medium text-text-secondary">Your bank</p>
        <p className="mt-3 text-sm text-text-secondary">Send to</p>
        <p className="break-words font-semibold text-text-primary">{sent?.recipient || "No recipient yet"}</p>
        <p className="mt-3 text-sm text-text-secondary">Amount</p>
        <p className="text-2xl font-bold text-text-primary">GHS {sent?.amount || "0.00"}</p>

        {result && warns && (
          <div role="group" aria-label="Warning shown to the customer" className="mt-4 rounded-xl border border-text-primary p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
              <Info aria-hidden className="size-4" />
              Before you send
            </p>
            <p className="mt-1 text-sm text-text-primary">{result.report.state_sentence}</p>
            {call && <p className="mt-2 text-sm text-text-primary">The bank will call you to confirm this payment.</p>}
          </div>
        )}

        {result && !warns && (
          <p className="mt-4 rounded-xl bg-surface-alt p-3 text-sm text-text-secondary">
            {result.allowed_use ? "Nothing is shown to the customer. This stays with the bank." : "Nothing is shown to the customer."}
          </p>
        )}

        <div className="mt-4 grid gap-2">
          <Button type="button" tabIndex={-1} aria-disabled className="pointer-events-none">
            Send
          </Button>
          <Button type="button" variant="secondary" tabIndex={-1} aria-disabled className="pointer-events-none">
            Go back
          </Button>
        </div>
        <p className="mt-3 text-center text-xs text-text-secondary">The customer always decides.</p>
      </div>
    </div>
  );
}

export default function PaymentCheckPage() {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <>
      <PageHeader title="Payment check" intro="The same real check your systems make through POST /v1/check, using your organisation's settings, shown beside an example of what a customer could see." />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Panel>
            <IdentifierForm
              withPayment
              label="Recipient"
              placeholder="+233 24 000 0000"
              submitLabel="Check payment"
              busy={busy}
              onSubmit={async ({ recipient, type, amount, newPayee }) => {
                setBusy(true);
                setError("");
                setResult(null);
                setSent({ recipient, amount });
                try {
                  setResult(
                    await api<CheckResult>("/payment-check", {
                      body: { recipient, type, new_payee: newPayee, ...(amount ? { amount_ghs: Number(amount) } : {}) },
                    }),
                  );
                } catch (err) {
                  setError(err instanceof ConsoleError ? err.message : "That didn't work. Try again.");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </Panel>
          {error && <ErrorNote>{error}</ErrorNote>}
          {result && <ResultPanel result={result} />}
        </div>
        <MockPaymentScreen result={result} sent={sent} />
      </div>
    </>
  );
}
