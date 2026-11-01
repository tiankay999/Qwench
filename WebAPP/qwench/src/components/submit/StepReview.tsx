"use client";

interface StepReviewProps {
  name: string;
  type: string;
  source: string;
  details: string;
}

export function StepReview({ name, type, source, details }: StepReviewProps) {
  const fields = [
    { label: "Investment", value: name },
    { label: "Type", value: type },
    { label: "Source", value: source },
    { label: "Details", value: details },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-text-primary mb-2">
        Review your report
      </h2>
      <p className="text-sm text-text-secondary mb-6">
        Make sure everything looks correct before submitting.
      </p>
      <dl className="space-y-4">
        {fields.map((f) => (
          <div
            key={f.label}
            className="border-b border-border pb-4"
          >
            <dt className="text-xs text-text-muted uppercase tracking-wide font-medium mb-1">
              {f.label}
            </dt>
            <dd className="text-sm text-text-primary">
              {f.value || "Not provided"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
