import {
  Flag,
  Landmark,
  ListChecks,
  SearchX,
  TriangleAlert,
  UserRoundSearch,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { stateOf, type StatusTone } from "@/lib/qwench";

/**
 * The legal state of a name, as the API reported it.
 *
 * This component used to render a traffic light: `warning` in red, then amber,
 * then `listed` in green — with a ✅ on the licensed state. That told every
 * reader that a licensed firm was safe and a named one was dangerous, which is
 * a verdict, and verdicts are the one output Qwench does not produce.
 *
 * What replaced it: five categorical roles in hues that refuse to form a
 * scale. Navy, violet, amber, teal and grey cannot be ranked by eye, which is
 * the point. If you can sort them, the implementation is wrong.
 *
 * Every badge carries colour, a drawn mark and words together. Remove any one
 * and the other two still say the same thing — which is what keeps it legible
 * in greyscale, in forced-colours mode, to a colour-blind reader, and in a
 * screenshot that has been through three rounds of WhatsApp compression.
 */
const tones: Record<StatusTone, string> = {
  named: "bg-named-tint text-named-ink",
  reviewed: "bg-reviewed-tint text-reviewed-ink",
  signs: "bg-signs-tint text-signs-ink",
  listed: "bg-listed-tint text-listed-ink",
  nothing: "bg-nothing-tint text-nothing-ink",
};

/** Not one of these is a tick, a cross, a shield or a gauge. */
const marks: Record<StatusTone, LucideIcon> = {
  named: TriangleAlert,
  reviewed: UserRoundSearch,
  signs: Flag,
  listed: ListChecks,
  nothing: SearchX,
};

/** `authority` is still the Listed role; it just reads better as a building. */
const overrides: Record<string, LucideIcon> = {
  authority: Landmark,
};

export function StateBadge({
  state,
  size = "sm",
  className,
}: {
  state: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const { label, tone } = stateOf(state);
  const Mark = overrides[state] ?? marks[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full font-semibold",
        tones[tone],
        size === "lg" ? "px-4 py-2 text-sm" : "px-3.5 py-1.5 text-xs",
        className,
      )}
    >
      <Mark
        className={size === "lg" ? "size-4" : "size-3.5"}
        strokeWidth={1.75}
        aria-hidden
      />
      {label}
    </span>
  );
}
