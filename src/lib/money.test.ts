import { describe, expect, it } from "vitest";
import { formatInrFromPaise, safeAddPaise, toPaiseFromInput } from "@/lib/money";

describe("money utilities", () => {
  it("converts decimal input to paise deterministically", () => {
    expect(toPaiseFromInput("10")).toBe(1000);
    expect(toPaiseFromInput("10.25")).toBe(1025);
    expect(toPaiseFromInput("0.1")).toBe(10);
    expect(toPaiseFromInput("")).toBe(0);
  });

  it("sums paise values safely", () => {
    expect(safeAddPaise([1000, 250, 750])).toBe(2000);
  });

  it("formats INR from paise", () => {
    expect(formatInrFromPaise(12345)).toContain("123.45");
  });
});
