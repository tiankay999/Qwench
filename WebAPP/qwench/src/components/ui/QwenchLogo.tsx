/**
 * The Q Mark.
 *
 * A ring cut by a forward-leaning tail: scrutiny, then forward progress. It is
 * drawn, not typeset — the previous mark put the Q in an SVG <text> element,
 * so it rendered in whatever face the device happened to have.
 *
 * What it is NOT, deliberately: a shield. The mark this replaced was a shield,
 * which is the universal sign of protection, and Qwench protects nobody — it
 * publishes a record and the reader decides. See DESIGN.md, "The No Approval
 * Rule".
 *
 * This is an authored approximation of the brand sheet's mark. Swap it for the
 * production SVG when that asset lands; nothing else imports the geometry.
 */

/* Every instance paints the same three gradients, so the ids are constants
   rather than generated per render. Where the mark appears more than once, the
   duplicate defs resolve to identical gradients and every instance renders the
   same — and the component stays pure, which a counter incremented during
   render would not be. */
const id = "qwench-mark";

export function QwenchLogo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-label="Qwench"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${id}-ring`} x1="6" y1="4" x2="33" y2="35" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E6BFF" />
          <stop offset="55%" stopColor="#0B6BFF" />
          <stop offset="100%" stopColor="#0A4FC4" />
        </linearGradient>
        <linearGradient id={`${id}-tail`} x1="22" y1="20" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60D4FF" />
          <stop offset="100%" stopColor="#2BA8E8" />
        </linearGradient>
        {/* Notches the ring where the tail crosses it, so the tail reads as
            cutting through rather than sitting on top. */}
        <mask id={`${id}-cut`}>
          <rect width="40" height="40" fill="white" />
          <path d="M16.6 26.2 L26.2 16.6 L36.0 26.4 L26.4 36.0 Z" fill="black" />
        </mask>
      </defs>

      <circle
        cx="19"
        cy="19"
        r="12.4"
        stroke={`url(#${id}-ring)`}
        strokeWidth="7"
        mask={`url(#${id}-cut)`}
      />

      <path
        d="M19.6 25.6 L25.6 19.6 L33.4 27.4 L27.4 33.4 Z"
        fill={`url(#${id}-tail)`}
      />
    </svg>
  );
}

/** The mark plus the logotype, locked up as the brand sheet shows it. */
export function QwenchWordmark({
  size = 30,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <QwenchLogo size={size} />
      <span
        className="font-display font-extrabold tracking-[-0.03em]"
        style={{ fontSize: size * 0.68 }}
      >
        Qwench
      </span>
    </span>
  );
}
