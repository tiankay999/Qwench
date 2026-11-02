import { cn } from "@/lib/cn";
import { type ButtonHTMLAttributes } from "react";

/**
 * Secondary is the default in this system and primary is the exception: most
 * actions on a register are navigation, and only one thing per view should
 * read as "press this".
 *
 * The `danger` variant is gone. It existed on a public surface in a product
 * that issues no verdicts, and the only thing it ever coloured was a verdict.
 * Form errors use ErrorNote; destructive console actions have their own.
 */
type Variant = "primary" | "secondary" | "quiet" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  href?: string;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white font-semibold hover:bg-accent-bright active:bg-accent",
  secondary:
    "border border-border-strong bg-surface text-text-primary font-semibold hover:bg-surface-alt hover:border-text-secondary",
  // kept as an alias so existing call sites keep working
  outline:
    "border border-border-strong bg-surface text-text-primary font-semibold hover:bg-surface-alt hover:border-text-secondary",
  quiet:
    "text-accent font-semibold hover:bg-surface-alt",
};

export function Button({
  variant = "primary",
  className,
  href,
  children,
  ...props
}: ButtonProps) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-[10px] px-6 py-3 text-base",
    "min-h-[48px] cursor-pointer transition-colors duration-150 ease-out-expo",
    // A disabled control must not depend on what is behind it for its
    // contrast, so this sets real colours rather than reducing opacity.
    "disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-text-muted disabled:border-transparent disabled:hover:bg-surface-alt",
    variants[variant],
    className,
  );

  if (href) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
