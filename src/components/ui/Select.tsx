import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-11 w-full rounded-control border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus:border-[rgba(196,106,58,0.35)] focus:outline-none focus:ring-2 focus:ring-[rgba(196,106,58,0.15)]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
