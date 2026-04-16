import type { PropsWithChildren } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends PropsWithChildren {
  className?: string;
}

export function Card({ className, children }: CardProps) {
  return <section className={cn("rounded-card border border-border-subtle bg-bg-elevated p-4", className)}>{children}</section>;
}
