import { describe, expect, it } from "vitest";
import {
  computeByDateMonthlyNeeded,
  computeMonthsRemaining,
  getCategoryFundingStatus,
} from "./targets";

describe("getCategoryFundingStatus", () => {
  it("returns null when no target is set", () => {
    expect(
      getCategoryFundingStatus({
        targetType: null,
        targetAmount: null,
        targetDate: null,
        allocatedBalance: "50.00",
        allocatedThisMonth: "0.00",
      })
    ).toBeNull();
  });

  describe("refill_up_to", () => {
    it("is funded once balance reaches the target, regardless of this month's allocations", () => {
      const status = getCategoryFundingStatus({
        targetType: "refill_up_to",
        targetAmount: "150.00",
        targetDate: null,
        allocatedBalance: "150.00",
        allocatedThisMonth: "0.00",
      });
      expect(status).toEqual({ targetType: "refill_up_to", underfunded: false, progressPercent: 100 });
    });

    it("is underfunded below the target and reports progress percent", () => {
      const status = getCategoryFundingStatus({
        targetType: "refill_up_to",
        targetAmount: "150.00",
        targetDate: null,
        allocatedBalance: "40.00",
        allocatedThisMonth: "40.00",
      });
      expect(status).toEqual({
        targetType: "refill_up_to",
        underfunded: true,
        progressPercent: 27,
      });
    });

    it("spending the balance back down re-flags it as underfunded (no memory of having been full)", () => {
      const status = getCategoryFundingStatus({
        targetType: "refill_up_to",
        targetAmount: "150.00",
        targetDate: null,
        allocatedBalance: "10.00",
        allocatedThisMonth: "0.00",
      });
      expect(status?.underfunded).toBe(true);
    });
  });

  describe("set_aside_monthly", () => {
    it("is funded once this month's allocations meet the target, regardless of running balance", () => {
      const status = getCategoryFundingStatus({
        targetType: "set_aside_monthly",
        targetAmount: "300.00",
        targetDate: null,
        allocatedBalance: "9000.00", // large carried-over balance shouldn't matter
        allocatedThisMonth: "300.00",
      });
      expect(status).toEqual({ targetType: "set_aside_monthly", underfunded: false });
    });

    it("is underfunded when this month hasn't hit the target yet", () => {
      const status = getCategoryFundingStatus({
        targetType: "set_aside_monthly",
        targetAmount: "300.00",
        targetDate: null,
        allocatedBalance: "9000.00",
        allocatedThisMonth: "100.00",
      });
      expect(status).toEqual({ targetType: "set_aside_monthly", underfunded: true });
    });
  });

  describe("by_date", () => {
    it("computes monthly need from remaining amount over remaining months", () => {
      const status = getCategoryFundingStatus(
        {
          targetType: "by_date",
          targetAmount: "1200.00",
          targetDate: "2027-01-01", // 6 months out from 2026-07-01
          allocatedBalance: "0.00",
          allocatedThisMonth: "0.00",
        },
        new Date(Date.UTC(2026, 6, 1))
      );
      expect(status).toEqual({
        targetType: "by_date",
        underfunded: true,
        monthlyNeeded: "200.00",
        monthsRemaining: 6,
      });
    });

    it("accounts for balance already saved when computing monthly need", () => {
      const status = getCategoryFundingStatus(
        {
          targetType: "by_date",
          targetAmount: "1200.00",
          targetDate: "2027-01-01",
          allocatedBalance: "600.00",
          allocatedThisMonth: "100.00",
        },
        new Date(Date.UTC(2026, 6, 1))
      );
      expect(status).toEqual({
        targetType: "by_date",
        underfunded: false, // 100 allocated this month meets the 100/mo now needed
        monthlyNeeded: "100.00",
        monthsRemaining: 6,
      });
    });

    it("never divides by zero for a deadline that's this month or overdue", () => {
      const status = getCategoryFundingStatus(
        {
          targetType: "by_date",
          targetAmount: "500.00",
          targetDate: "2026-01-01", // in the past relative to "today"
          allocatedBalance: "0.00",
          allocatedThisMonth: "0.00",
        },
        new Date(Date.UTC(2026, 6, 1))
      );
      expect(status).toMatchObject({ monthsRemaining: 1, monthlyNeeded: "500.00" });
    });

    it("reports zero monthly need once fully funded", () => {
      const status = getCategoryFundingStatus(
        {
          targetType: "by_date",
          targetAmount: "500.00",
          targetDate: "2027-01-01",
          allocatedBalance: "500.00",
          allocatedThisMonth: "0.00",
        },
        new Date(Date.UTC(2026, 6, 1))
      );
      expect(status).toEqual({
        targetType: "by_date",
        underfunded: false,
        monthlyNeeded: "0.00",
        monthsRemaining: 6,
      });
    });
  });
});

describe("computeMonthsRemaining", () => {
  it("counts whole calendar months to the target date", () => {
    expect(computeMonthsRemaining("2027-01-01", new Date(Date.UTC(2026, 6, 1)))).toBe(6);
  });

  it("floors at 1 for a same-month or past target date", () => {
    expect(computeMonthsRemaining("2026-07-15", new Date(Date.UTC(2026, 6, 1)))).toBe(1);
    expect(computeMonthsRemaining("2020-01-01", new Date(Date.UTC(2026, 6, 1)))).toBe(1);
  });
});

describe("computeByDateMonthlyNeeded", () => {
  it("divides the remaining amount across remaining months", () => {
    expect(computeByDateMonthlyNeeded(1000, 200, 4)).toBe(200);
  });

  it("never goes negative when the balance already exceeds the target", () => {
    expect(computeByDateMonthlyNeeded(1000, 1500, 4)).toBe(0);
  });
});
