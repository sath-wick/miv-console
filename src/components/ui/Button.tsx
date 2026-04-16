import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-accent-primary text-text-primary border border-transparent hover:brightness-105 active:bg-[rgba(196,106,58,0.85)]",
  secondary:
    "bg-bg-surface text-text-primary border border-border-strong hover:bg-bg-elevated active:bg-accent-soft",
  ghost:
    "bg-transparent text-text-secondary border border-transparent hover:bg-accent-soft active:bg-accent-soft",
  danger: "bg-red-900/50 text-text-primary border border-red-900/60 hover:bg-red-900/60"
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "min-h-11 rounded-control px-4 py-3 text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}
