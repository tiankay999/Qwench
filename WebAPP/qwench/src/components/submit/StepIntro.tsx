"use client";

interface StepIntroProps {
  value: string;
  onChange: (v: string) => void;
}

export function StepIntro({ value, onChange }: StepIntroProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-text-primary mb-2">
        What investment do you want to report?
      </h2>
      <p className="text-sm text-text-secondary mb-6">
        Enter the name of the company, token, or scheme.
      </p>
      <label className="block">
        <span className="text-sm font-medium text-text-primary mb-2 block">
          Investment name
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. FortuneX Pro"
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors"
        />
      </label>
    </div>
  );
}
