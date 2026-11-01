"use client";

import { Chip } from "@/components/ui/Chip";

const options = [
  "Crypto / Token",
  "Forex / Trading",
  "Ponzi / MLM",
  "Real Estate",
  "Mobile Money",
  "Other",
];

interface StepTypeProps {
  value: string;
  onChange: (v: string) => void;
}

export function StepType({ value, onChange }: StepTypeProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-text-primary mb-2">
        What type of investment is it?
      </h2>
      <p className="text-sm text-text-secondary mb-6">
        Select the category that best describes this investment.
      </p>
      <div className="flex flex-wrap gap-3">
        {options.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            active={value === opt}
            onClick={() => onChange(opt)}
          />
        ))}
      </div>
    </div>
  );
}
