"use client";

import { cn } from "@/lib/cn";

/**
 * A selected chip takes an accent border and an accent label, never a filled
 * accent background. A filter that is painted in the button colour reads as a
 * submit, and the reader presses it expecting something to happen.
 */
export function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-semibold min-h-[44px] cursor-pointer",
        "transition-colors duration-150 ease-out-expo",
        active
          ? "border border-accent bg-surface text-accent"
          : "border border-transparent bg-surface-alt text-text-secondary hover:text-text-primary hover:border-border-strong",
      )}
    >
      {label}
    </button>
  );
}
