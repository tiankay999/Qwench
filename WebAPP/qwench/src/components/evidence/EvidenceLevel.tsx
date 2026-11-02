import { Layers } from "lucide-react";
import { TIER, type EvidenceLevel as Level } from "@/lib/qwench";

/**
 * How much evidence there is, and what kind.
 *
 * This grades the evidence, never the scheme. The label and the sentence under
 * it are written by the backend; the tier line explains where that evidence
 * came from. No number here is a score, and none of them can be compared to a
 * number on another page.
 */
export function EvidenceLevelBlock({ level, tier }: { level: Level; tier: number | null }) {
  const t = tier ? TIER[tier] : null;

  return (
    <div className="rounded-xl border border-border bg-surface-alt p-5">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="w-4 h-4 text-accent" aria-hidden />
        <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">
          Evidence level
        </h2>
      </div>
      <p className="font-bold text-text-primary">{level.label}</p>
      <p className="text-sm text-text-secondary mt-1">{level.meaning}</p>
      {t && (
        <p className="text-xs text-text-muted mt-3 pt-3 border-t border-border">
          <span className="font-semibold text-text-secondary">{t.label}</span> — {t.meaning}
        </p>
      )}
    </div>
  );
}
