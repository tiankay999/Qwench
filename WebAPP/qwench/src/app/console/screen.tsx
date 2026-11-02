"use client";

import { useState } from "react";
import { IdentifierForm, type IdentifierValue } from "@/components/console/IdentifierForm";
import { ResultPanel } from "@/components/console/ResultPanel";
import { ErrorNote, PageHeader, Panel } from "@/components/console/ui";
import { ConsoleError, api, type CheckResult } from "@/lib/console";

export default function LookupPage() {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [prefill, setPrefill] = useState<Partial<IdentifierValue>>();

  async function run(recipient: string, type: string) {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api<CheckResult>("/lookup", { body: { recipient, type } }));
    } catch (err) {
      setError(err instanceof ConsoleError ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const suggestion = result?.did_you_mean?.suggested_entity;

  return (
    <>
      <PageHeader title="Lookup" intro="Check a number, name, website or wallet against reviewed records and what members have confirmed." />
      <Panel className="mb-6">
        <IdentifierForm key={formKey} initial={prefill} label="What do you want to check?" placeholder="+233 24 000 0000, a name or a website" submitLabel="Look up" busy={busy} onSubmit={({ recipient, type }) => run(recipient, type)} />
      </Panel>

      {error && <ErrorNote>{error}</ErrorNote>}

      {suggestion && (
        <p className="mb-4 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary">
          Close to a reviewed name.{" "}
          <button
            type="button"
            className="font-semibold text-mid-navy underline dark:text-accent"
            onClick={() => {
              setPrefill({ recipient: suggestion, type: "name" });
              setFormKey((k) => k + 1);
              run(suggestion, "name");
            }}
          >
            Look up {suggestion}
          </button>
        </p>
      )}

      {result && <ResultPanel result={result} showMembers />}
    </>
  );
}
