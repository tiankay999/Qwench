import { Layers } from "lucide-react";
import { TIER, type EvidenceLevel as Level } from "@/lib/qwench";

/**
 * How much evidence there is, and what kind.
 *
 * This grades the evidence, never the scheme. The label and the sentence under
 * it are written by the backend; the tier line explains where that evidence
 * came from. No number here is a score, and none of them can be compared to a
 * number on another page.
 *
 * The panel is set into the document on the sunken ground rather than lifted
 * off it, and it carries no status colour of its own — the badge above it does
 * that. A coloured fill here would read as the page's own conclusion.
 */
export function EvidenceLevelBlock({ level, tier }: { level: Level; tier: number | null }) {
  const t = tier ? TIER[tier] : null;

  return (
    <section className="rounded-[14px] bg-surface-alt px-5 py-5 md:px-6">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-text-secondary">
        <Layers className="size-3.5" strokeWidth={1.75} aria-hidden />
        Evidence level
      </h2>

      <p className="font-display text-lg font-bold tracking-[-0.015em] text-text-primary">
        {level.label}
      </p>

      <p className="mt-1.5 max-w-[68ch] text-base leading-relaxed text-text-secondary">
        {level.meaning}
      </p>

      {t && (
        <p className="mt-4 border-t border-border pt-4 text-sm text-text-secondary">
          <span className="font-semibold text-text-primary">{t.label}</span> — {t.meaning}
        </p>
      )}
    </section>
  );
}
