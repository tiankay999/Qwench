"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ConsoleError, api, type ConsoleUser } from "@/lib/console";
import { Button, ErrorNote, Field, inputClass } from "./ui";

export function LoginForm({ onSignedIn }: { onSignedIn: (user: ConsoleUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api<{ user: ConsoleUser }>("/login", { body: { email, password } });
      onSignedIn(user);
    } catch (err) {
      setError(err instanceof ConsoleError ? err.message : "That didn't work. Try again.");
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 text-text-primary">
          <ShieldCheck aria-hidden className="size-6 text-mid-navy dark:text-accent" />
          <span className="text-lg font-bold">Qwench</span>
          <span className="text-text-secondary">Console</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">Log in</h1>
        <p className="mt-1 mb-6 text-sm text-text-secondary">For banks, MoMo operators, regulators and Qwench staff. Your organisation admin or Qwench sets up accounts.</p>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Work email" htmlFor="email">
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Password" htmlFor="password">
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
