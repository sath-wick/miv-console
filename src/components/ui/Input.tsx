import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-control border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-[rgba(196,106,58,0.35)] focus:outline-none focus:ring-2 focus:ring-[rgba(196,106,58,0.15)]",
        className
      )}
      {...props}
    />
  );
}
