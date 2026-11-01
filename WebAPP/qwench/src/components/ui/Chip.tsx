"use client";

import { cn } from "@/lib/cn";

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px] cursor-pointer",
        active
          ? "bg-accent text-primary"
          : "bg-surface-alt text-text-secondary hover:bg-border"
      )}
    >
      {label}
    </button>
  );
}
