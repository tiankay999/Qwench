import { GitCompareArrows } from "lucide-react";

/**
 * Asked before anything else, when a name is close to one on a register.
 *
 * Answering about the registered firm would be wrong if the visitor meant the
 * other one, and answering about the other one would be wrong if they simply
 * mistyped. So neither answer is given until they pick. Nothing here says the
 * name they typed is an impersonation — only that two names are close.
 */
export function DidYouMean({
  original,
  suggested,
  onPick,
}: {
  original: string;
  suggested: string;
  onPick: (name: string, exact: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center gap-2 mb-3">
        <GitCompareArrows className="w-4 h-4 text-accent" aria-hidden />
        <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">
          Which did you mean?
        </h2>
      </div>

      <p className="text-sm text-text-secondary mb-5">
        You asked about <span className="font-semibold text-text-primary">{original}</span>.
        There is a registered entity called{" "}
        <span className="font-semibold text-text-primary">{suggested}</span>. Names that
        are nearly the same are easy to mix up, so pick the one you meant.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => onPick(suggested, false)}
          className="rounded-lg border border-border bg-surface-alt px-4 py-3 text-left hover:border-accent transition-colors cursor-pointer min-h-[44px]"
        >
          <span className="block text-xs text-text-muted mb-0.5">Check the registered one</span>
          <span className="block font-semibold text-text-primary">{suggested}</span>
        </button>
        <button
          onClick={() => onPick(original, true)}
          className="rounded-lg border border-border bg-surface-alt px-4 py-3 text-left hover:border-accent transition-colors cursor-pointer min-h-[44px]"
        >
          <span className="block text-xs text-text-muted mb-0.5">Check it as I typed it</span>
          <span className="block font-semibold text-text-primary">{original}</span>
        </button>
      </div>
    </div>
  );
}
