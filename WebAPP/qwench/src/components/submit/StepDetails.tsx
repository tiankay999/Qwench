"use client";

import { Upload } from "lucide-react";

interface StepDetailsProps {
  value: string;
  onChange: (v: string) => void;
}

export function StepDetails({ value, onChange }: StepDetailsProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-text-primary mb-2">
        Tell us what happened
      </h2>
      <p className="text-sm text-text-secondary mb-6">
        The more detail you share, the more it helps others.
      </p>
      <label className="block mb-4">
        <span className="text-sm font-medium text-text-primary mb-2 block">
          Your experience
        </span>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          placeholder="Describe your experience with this investment..."
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors resize-none"
        />
      </label>
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-accent transition-colors">
        <Upload className="w-8 h-8 text-text-muted mx-auto mb-2" />
        <p className="text-sm text-text-secondary">
          Drop screenshots or evidence here
        </p>
        <p className="text-xs text-text-muted mt-1">PNG, JPG up to 5MB</p>
      </div>
    </div>
  );
}
