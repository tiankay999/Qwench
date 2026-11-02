"use client";

import { AlertCircle, Inbox } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Console primitives.
 *
 * This is an Operate surface: the member came to get a job done, so the world
 * lends type, palette and density, and never the layout or the controls. Every
 * control here is the standard one a member already knows.
 *
 * Changes from the previous build: 44px targets throughout (was 40px), the
 * brand display face on headings, focus rings from the token rather than
 * `outline-mid-navy`, and disabled states that set real colours instead of
 * `opacity-50` — a translucent control's contrast depends on whatever is
 * behind it, so it cannot be verified.
 */

export function PageHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <header className="mb-7">
      <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary">
        {title}
      </h1>
      <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-text-secondary">
        {intro}
      </p>
    </header>
  );
}

export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[14px] border border-border bg-surface p-5", className)}>
      {title && (
        <h2 className="mb-3 font-display text-[15px] font-bold tracking-[-0.01em] text-text-primary">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "destructive";
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-5 text-sm font-semibold",
        "transition-colors duration-150 ease-out-expo",
        "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-alt disabled:text-text-muted",
        variant === "primary" &&
          "bg-accent text-white hover:bg-accent-bright disabled:hover:bg-surface-alt",
        variant === "secondary" &&
          "border border-border-strong bg-surface text-text-primary hover:bg-surface-alt",
        variant === "destructive" &&
          "border border-danger bg-surface text-danger hover:bg-danger hover:text-white",
        className,
      )}
    />
  );
}

export const inputClass =
  "min-h-11 w-full rounded-[10px] border border-border-strong bg-surface px-3.5 text-base text-text-primary placeholder:text-text-muted";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-text-primary">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{hint}</p>
      )}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2.5 rounded-[10px] border border-danger/40 bg-danger/5 px-3.5 py-3 text-sm text-text-primary"
    >
      <AlertCircle aria-hidden strokeWidth={1.75} className="mt-0.5 size-4 shrink-0 text-danger" />
      <span>{children}</span>
    </p>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[14px] border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
      <Inbox aria-hidden strokeWidth={1.5} className="mb-3 size-6 text-text-muted" />
      <p className="font-display text-[15px] font-bold text-text-primary">{title}</p>
      {children && (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-text-secondary">{children}</p>
      )}
    </div>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-alt px-3 py-1 text-xs font-semibold text-text-primary">
      {children}
    </span>
  );
}

/** Rule 11: demo data is labelled, always, and never looks like a real record. */
export function DemoTag() {
  return (
    <span className="inline-flex items-center rounded-full bg-mid-navy px-3 py-1 text-xs font-semibold text-white dark:bg-surface-alt dark:text-text-primary">
      Demo data
    </span>
  );
}

export function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
      {items.map(([term, value]) => (
        <div key={term} className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-[0.05em] text-text-secondary">
            {term}
          </dt>
          {/* Identifiers, dates and references are data a member may need to
              copy, so they are set in the evidence face with tabular figures. */}
          <dd className="tabular mt-1 break-words font-mono text-sm text-text-primary">
            {value}
          </dd>
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
