"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useConsoleUser } from "@/components/console/ConsoleShell";
import { Button, EmptyState, ErrorNote, Loading, PageHeader, Panel, Tag } from "@/components/console/ui";
import { API_SCOPES, ConsoleError, api, formatDate, type ApiKey } from "@/lib/console";

function NewKey({ value, onDone }: { value: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <Panel className="mb-6 border-text-primary">
      <h2 className="text-sm font-semibold text-text-primary">Copy this key now</h2>
      <p className="mt-1 mb-3 text-sm text-text-secondary">It won&apos;t be shown again. Qwench stores only a hash of it, so a lost key can&apos;t be recovered. Keep it on your servers, never in a browser or app.</p>
      <code className="block rounded-lg bg-surface-alt p-3 text-sm break-all text-text-primary select-all">{value}</code>
      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(value).catch(() => {});
            setCopied(true);
          }}
        >
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          I&apos;ve saved it
        </Button>
      </div>
    </Panel>
  );
}

export default function KeysPage() {
  const user = useConsoleUser();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [scopes, setScopes] = useState<string[]>(["check"]);
  const [fresh, setFresh] = useState("");
  const [confirming, setConfirming] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const allowed = user.role === "org_admin";

  const load = useCallback(
    () =>
      api<{ keys: ApiKey[] }>("/api-keys")
        .then(({ keys: list }) => setKeys(list))
        .catch((err) => setError(err instanceof ConsoleError ? err.message : "That didn't work. Try again.")),
    [],
  );

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  if (!allowed) return <EmptyState title="Only your organisation's admin can manage API keys." />;

  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
    } catch (err) {
      setError(err instanceof ConsoleError ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="API keys" intro={`Keys let ${user.organization}'s systems call Qwench. Give each key only the access it needs.`} />

      {fresh && <NewKey value={fresh} onDone={() => setFresh("")} />}

      <Panel title="Create a key" className="mb-6">
        <fieldset>
          <legend className="mb-2 text-sm text-text-secondary">What can this key do?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {API_SCOPES.map((scope) => (
              <label key={scope.value} htmlFor={`scope-${scope.value}`} className="flex min-h-10 items-center gap-2 text-sm text-text-primary">
                <input
                  id={`scope-${scope.value}`}
                  type="checkbox"
                  checked={scopes.includes(scope.value)}
                  onChange={(e) => setScopes((current) => (e.target.checked ? [...current, scope.value] : current.filter((s) => s !== scope.value)))}
                  className="size-4 accent-mid-navy"
                />
                {scope.label}
                <span className="text-xs text-text-secondary">{scope.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button
          className="mt-4"
          disabled={busy || !scopes.length}
          onClick={() =>
            act(async () => {
              const created = await api<ApiKey>("/api-keys", { body: { scopes } });
              setFresh(created.key || "");
            })
          }
        >
          Create key
        </Button>
      </Panel>

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      {!keys && !error && <Loading label="Loading keys" />}
      {keys && !keys.length && <EmptyState title="No API keys yet.">Create one above to connect your systems.</EmptyState>}

      {keys && keys.length > 0 && (
        <ul className="space-y-3">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium text-text-primary">{key.prefix}…</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {key.scopes.map((scope) => (
                    <Tag key={scope}>{scope}</Tag>
                  ))}
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  Created {formatDate(key.created_at)}. {key.last_used_at ? `Last used ${formatDate(key.last_used_at)}.` : "Not used yet."}
                </p>
              </div>
              {key.revoked_at ? (
                <Tag>Revoked {formatDate(key.revoked_at)}</Tag>
              ) : confirming === key.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-text-primary">Anything using it stops at once.</span>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        await api(`/api-keys/${key.id}`, { method: "DELETE" });
                        setConfirming("");
                      })
                    }
                  >
                    Revoke key
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirming("")}>
                    Keep key
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => setConfirming(key.id)}>
                  Revoke…
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
