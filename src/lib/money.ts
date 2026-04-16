export function toPaiseFromInput(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100);
}

export function formatInrFromPaise(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value / 100);
}

export function safeAddPaise(values: number[]): number {
  return values.reduce((sum, entry) => sum + Math.round(entry), 0);
}
