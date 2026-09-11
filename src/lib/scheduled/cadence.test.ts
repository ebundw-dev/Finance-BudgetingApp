import { describe, expect, it } from "vitest";
import { computeNextDueDate, isDueBy } from "./cadence";

describe("computeNextDueDate", () => {
  it("adds 7 days for weekly", () => {
    expect(computeNextDueDate("2026-09-11", "weekly", null)).toBe("2026-09-18");
  });

  it("adds 14 days for biweekly", () => {
    expect(computeNextDueDate("2026-09-11", "biweekly", null)).toBe("2026-09-25");
  });

  it("adds a calendar month for monthly, same day of month", () => {
    expect(computeNextDueDate("2026-09-11", "monthly", null)).toBe("2026-10-11");
  });

  it("clamps monthly to the last day of a shorter target month", () => {
    // Jan 31 + 1 month should land on Feb 28 (2026 is not a leap year), not
    // overflow into March.
    expect(computeNextDueDate("2026-01-31", "monthly", null)).toBe("2026-02-28");
  });

  it("clamps monthly to Feb 29 on a leap year", () => {
    expect(computeNextDueDate("2028-01-31", "monthly", null)).toBe("2028-02-29");
  });

  it("adds a calendar year for yearly, same month/day", () => {
    expect(computeNextDueDate("2026-09-11", "yearly", null)).toBe("2027-09-11");
  });

  it("clamps yearly off a leap-day date to Feb 28 the following non-leap year", () => {
    expect(computeNextDueDate("2028-02-29", "yearly", null)).toBe("2029-02-28");
  });

  it("adds intervalDays for custom_days", () => {
    expect(computeNextDueDate("2026-09-11", "custom_days", 10)).toBe("2026-09-21");
  });

  it("falls back to 30 days for custom_days with no/invalid intervalDays", () => {
    expect(computeNextDueDate("2026-09-11", "custom_days", null)).toBe("2026-10-11");
    expect(computeNextDueDate("2026-09-11", "custom_days", 0)).toBe("2026-10-11");
  });

  it("rolls correctly across a year boundary", () => {
    expect(computeNextDueDate("2026-12-20", "monthly", null)).toBe("2027-01-20");
  });
});

describe("isDueBy", () => {
  it("is due when the due date is today or earlier", () => {
    expect(isDueBy("2026-09-11", "2026-09-11")).toBe(true);
    expect(isDueBy("2026-09-01", "2026-09-11")).toBe(true);
  });

  it("is not due when the due date is in the future", () => {
    expect(isDueBy("2026-09-20", "2026-09-11")).toBe(false);
  });
});
