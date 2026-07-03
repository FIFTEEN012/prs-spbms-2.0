import { describe, it, expect } from "vitest";
import { parseThaiDateStr } from "@/lib/date-utils";

describe("CSV Import Date Parsing", () => {
  it("should parse standard ISO dates (YYYY-MM-DD)", () => {
    const d = parseThaiDateStr("2026-06-01");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(5); // June (0-indexed)
    expect(d!.getDate()).toBe(1);
  });

  it("should parse Buddhist calendar slash dates (DD/MM/YYYY where YYYY > 2400)", () => {
    const d = parseThaiDateStr("16/05/2569");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026); // 2569 - 543 = 2026
    expect(d!.getMonth()).toBe(4); // May (0-indexed)
    expect(d!.getDate()).toBe(16);
  });

  it("should parse Gregorian calendar slash dates (DD/MM/YYYY where YYYY <= 2400)", () => {
    const d = parseThaiDateStr("16/05/2026");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4); // May
    expect(d!.getDate()).toBe(16);
  });

  it("should return null for empty or invalid dates", () => {
    expect(parseThaiDateStr(null)).toBeNull();
    expect(parseThaiDateStr(undefined)).toBeNull();
    expect(parseThaiDateStr("   ")).toBeNull();
    expect(parseThaiDateStr("invalid-date")).toBeNull();
    expect(parseThaiDateStr("12/34/5678")).toBeNull();
  });
});
