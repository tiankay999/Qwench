"use client";

import { Chip } from "@/components/ui/Chip";

const sources = [
  "WhatsApp",
  "Facebook",
  "Instagram",
  "Twitter / X",
  "Friend / Family",
  "Website",
  "Other",
];

interface StepSourceProps {
  value: string;
  onChange: (v: string) => void;
}

export function StepSource({ value, onChange }: StepSourceProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-text-primary mb-2">
        Where did you find this investment?
      </h2>
      <p className="text-sm text-text-secondary mb-6">
        This helps us trace how scams spread.
      </p>
      <div className="flex flex-wrap gap-3">
        {sources.map((s) => (
          <Chip
            key={s}
            label={s}
            active={value === s}
            onClick={() => onChange(s)}
          />
        ))}
      </div>
    </div>
  );
}
