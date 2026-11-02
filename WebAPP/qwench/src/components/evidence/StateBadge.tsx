import { cn } from "@/lib/cn";
import { stateOf } from "@/lib/qwench";

/**
 * The legal state of a name, as the API reported it.
 *
 * The colour describes the kind of record, not how risky anything is. There is
 * no scale here: `warning` is not "worse" than `listed`, it is a different kind
 * of fact. Nothing in this file ranks anything.
 */
const tones = {
  warning: "bg-danger/10 text-danger border-danger/30",
  listed: "bg-safe/10 text-safe border-safe/30",
  provisional: "bg-warning/10 text-warning border-warning/30",
  neutral: "bg-text-muted/10 text-text-secondary border-border",
} as const;

export function StateBadge({
  state,
  size = "sm",
  className,
}: {
  state: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const { label, icon, tone } = stateOf(state);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border font-bold tracking-wide",
        tones[tone],
        size === "lg" ? "px-3.5 py-2 text-sm" : "px-3 py-1.5 text-xs",
        className,
      )}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}
