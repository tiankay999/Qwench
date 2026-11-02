import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

/**
 * Flat at rest. Depth in this system comes from moving between the three
 * grounds — sunken, canvas, surface — not from lifting things off the page.
 * A document whose every block floats has made all of its blocks equally
 * important.
 *
 * `interactive` is for a card that is wholly a link. It is the only case where
 * a card earns a shadow, and the shadow is a response to the pointer rather
 * than a permanent costume.
 */
export function Card({
  className,
  children,
  interactive,
  sunken,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean; sunken?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[14px] p-5 md:p-6",
        sunken
          ? "bg-surface-alt"
          : "border border-border bg-surface",
        interactive &&
          "transition-shadow duration-150 ease-out-expo hover:shadow-raised",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
