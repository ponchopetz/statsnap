import { describe, it, expect, vi, afterEach } from "vitest";
import { formatAge, formatHeight, formatDraft, formatNumber, formatPercent, formatSigned, formatDecimal } from "../format.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("formatAge", () => {
  it("counts whole years and handles the day before/after a birthday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 16)); // 16 Sep 2026, local time
    expect(formatAge("1995-09-17")).toBe(30); // birthday tomorrow
    expect(formatAge("1995-09-16")).toBe(31); // birthday today
    expect(formatAge("1995-09-15")).toBe(31);
  });

  it("returns null for missing or malformed input", () => {
    expect(formatAge(null)).toBeNull();
    expect(formatAge("")).toBeNull();
    expect(formatAge("1995")).toBeNull();
    expect(formatAge("abc-de-fg")).toBeNull();
  });
});

describe("formatHeight / formatDraft", () => {
  it("renders feet and inches, including exact feet", () => {
    expect(formatHeight(74)).toBe(`6'2"`);
    expect(formatHeight(72)).toBe(`6'0"`);
    expect(formatHeight(null)).toBeNull();
  });

  it("distinguishes undrafted from partial draft data", () => {
    expect(formatDraft(null, null, null)).toBe("Undrafted");
    expect(formatDraft(2017, 1, 10)).toBe("2017 · R1 · #10");
    expect(formatDraft(2017, null, 10)).toBeNull();
  });
});

describe("numeric formatters", () => {
  it("use an em dash for missing values", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatPercent(undefined)).toBe("—");
    expect(formatSigned(null)).toBe("—");
    expect(formatDecimal(null)).toBe("—");
  });

  it("format thousands, percentages, signs, and decimals", () => {
    expect(formatNumber(4280)).toBe("4,280");
    expect(formatNumber(4280.6)).toBe("4,281");
    expect(formatPercent(0.6734)).toBe("67.3%");
    expect(formatPercent(0.6734, 0)).toBe("67%");
    expect(formatSigned(4.25, 2)).toBe("+4.25");
    expect(formatSigned(-1.8)).toBe("-1.8");
    expect(formatSigned(0)).toBe("+0.0");
    expect(formatDecimal(13.56)).toBe("13.6");
  });
});
