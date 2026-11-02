"use client";

interface RiskGaugeProps {
  score: number;
}

function scoreColor(score: number): string {
  if (score >= 7) return "#e94560";
  if (score >= 4) return "#f39c12";
  return "#2ecc71";
}

export function RiskGauge({ score }: RiskGaugeProps) {
  const color = scoreColor(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * 0.75;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative w-36 h-36">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-135">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-border"
          strokeWidth="10"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeLinecap="round"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${circumference * progress} ${circumference * (1 - progress)}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold" style={{ color }}>
          {score}
        </span>
        <span className="text-xs text-text-muted font-medium">OUT OF 10</span>
      </div>
    </div>
  );
}
