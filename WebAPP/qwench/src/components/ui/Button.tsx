import { cn } from "@/lib/cn";
import { type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "danger" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  href?: string;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-primary font-semibold hover:brightness-110",
  danger:
    "bg-danger text-white font-semibold hover:brightness-110",
  outline:
    "border border-border text-text-primary bg-transparent hover:bg-surface-alt",
  ghost:
    "text-text-secondary hover:text-text-primary hover:bg-surface-alt",
};

export function Button({
  variant = "primary",
  className,
  href,
  children,
  ...props
}: ButtonProps) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm transition-all cursor-pointer min-h-[44px]",
    variants[variant],
    className
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
