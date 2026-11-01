"use client";

export function QwenchLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="shield-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a1a2e" />
          <stop offset="100%" stopColor="#00d4aa" />
        </linearGradient>
      </defs>
      <path
        d="M20 2L4 10V20C4 30 20 38 20 38C20 38 36 30 36 20V10L20 2Z"
        fill="url(#shield-gradient)"
      />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        fill="white"
        fontSize="16"
        fontWeight="800"
        fontFamily="Inter, sans-serif"
      >
        Q
      </text>
    </svg>
  );
}
