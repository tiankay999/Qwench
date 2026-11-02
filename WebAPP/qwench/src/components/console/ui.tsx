"use client";

import { AlertCircle, Inbox } from "lucide-react";
import { cn } from "@/lib/cn";

export function PageHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-text-primary">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-text-secondary">{intro}</p>
    </header>
  );
}

export function Panel({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface p-5", className)}>
      {title && <h2 className="mb-3 text-sm font-semibold text-text-primary">{title}</h2>}
      {children}
    </section>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mid-navy disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" ? "bg-mid-navy text-white hover:opacity-90" : "border border-border bg-surface text-text-primary hover:bg-surface-alt",
        className,
      )}
    />
  );
}

export const inputClass =
  "min-h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-secondary focus:outline-2 focus:outline-offset-1 focus:outline-mid-navy";

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-text-primary">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-text-primary">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
      <span>{children}</span>
    </p>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <Inbox aria-hidden className="mb-3 size-6 text-text-secondary" />
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {children && <p className="mt-1 max-w-md text-sm text-text-secondary">{children}</p>}
    </div>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-md border border-border bg-surface-alt px-2 py-0.5 text-xs font-medium text-text-primary">{children}</span>;
}

export function DemoTag() {
  return <span className="inline-flex items-center rounded-md bg-mid-navy px-2 py-0.5 text-xs font-semibold text-white">Demo data</span>;
}

export function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([term, value]) => (
        <div key={term} className="min-w-0">
          <dt className="text-xs font-medium text-text-secondary">{term}</dt>
          <dd className="mt-0.5 break-words text-sm text-text-primary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <p role="status" className="py-8 text-center text-sm text-text-secondary">
      {label}…
    </p>
  );
}
