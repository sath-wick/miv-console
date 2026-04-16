export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayDateKey(): string {
  return toDateKey(new Date());
}

export function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}
