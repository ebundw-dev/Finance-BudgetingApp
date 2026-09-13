import { describe, expect, it } from "vitest";
import { comparePayoffStrategies, projectPayoffDate, type PlannerDebtInput } from "./planner";

describe("comparePayoffStrategies", () => {
  it("orders avalanche by highest APR first, snowball by lowest balance first", () => {
    const debts: PlannerDebtInput[] = [
      { id: "a", name: "Card A", balance: 5000, apr: 15, minimumPayment: 100 },
      { id: "b", name: "Card B", balance: 1000, apr: 25, minimumPayment: 50 },
      { id: "c", name: "Card C", balance: 2000, apr: 20, minimumPayment: 75 },
    ];

    const { avalanche, snowball } = comparePayoffStrategies(debts, 0);

    expect(avalanche.order).toEqual(["b", "c", "a"]); // 25% > 20% > 15%
    expect(snowball.order).toEqual(["b", "c", "a"]); // 1000 < 2000 < 5000
  });

  it("pays off a single debt with no interest in exactly balance/payment months", () => {
    const debts: PlannerDebtInput[] = [{ id: "a", name: "Zero APR", balance: 1200, apr: 0, minimumPayment: 100 }];

    const { avalanche } = comparePayoffStrategies(debts, 0);

    expect(avalanche.totalMonths).toBe(12);
    expect(avalanche.debts[0].payoffMonth).toBe(12);
    expect(avalanche.debts[0].totalInterestPaid).toBe("0.00");
  });

  it("rolls a paid-off debt's minimum payment into the next debt (snowball effect)", () => {
    // Debt "small" pays off fast, freeing its $50 minimum to accelerate
    // "big" -- total months should be noticeably less than paying big
    // alone with just its own $50 minimum would take.
    const debts: PlannerDebtInput[] = [
      { id: "small", name: "Small", balance: 100, apr: 0, minimumPayment: 50 },
      { id: "big", name: "Big", balance: 1000, apr: 0, minimumPayment: 50 },
    ];

    const { snowball } = comparePayoffStrategies(debts, 0);

    const small = snowball.debts.find((d) => d.id === "small")!;
    const big = snowball.debts.find((d) => d.id === "big")!;

    expect(small.payoffMonth).toBe(2);
    // Without rollover, 1000/50 = 20 months. With small's $50 rolling in
    // after month 2, big should finish well before month 20.
    expect(big.payoffMonth).not.toBeNull();
    expect(big.payoffMonth!).toBeLessThan(20);
  });

  it("applies extraMonthlyPayment to the top-priority open debt", () => {
    const debts: PlannerDebtInput[] = [
      { id: "a", name: "A", balance: 1000, apr: 0, minimumPayment: 50 },
      { id: "b", name: "B", balance: 1000, apr: 0, minimumPayment: 50 },
    ];

    const withoutExtra = comparePayoffStrategies(debts, 0);
    const withExtra = comparePayoffStrategies(debts, 100);

    expect(withExtra.avalanche.totalMonths!).toBeLessThan(withoutExtra.avalanche.totalMonths!);
  });

  it("accrues monthly interest at apr/100/12 and reports it per debt", () => {
    // $1200 at 12% APR = 1% monthly interest = $12 the first month; the
    // minimum comfortably covers balance + that interest in one shot.
    const debts: PlannerDebtInput[] = [{ id: "a", name: "A", balance: 1200, apr: 12, minimumPayment: 1300 }];

    const { avalanche } = comparePayoffStrategies(debts, 0);

    expect(avalanche.debts[0].payoffMonth).toBe(1);
    expect(avalanche.debts[0].totalInterestPaid).toBe("12.00");
  });

  it("returns null payoffMonth/totalMonths when minimums can't outpace interest", () => {
    // $10 minimum against $10,000 at 30% APR (~$250/mo interest) never converges.
    const debts: PlannerDebtInput[] = [{ id: "a", name: "Underwater", balance: 10000, apr: 30, minimumPayment: 10 }];

    const { avalanche } = comparePayoffStrategies(debts, 0);

    expect(avalanche.debts[0].payoffMonth).toBeNull();
    expect(avalanche.totalMonths).toBeNull();
  });

  it("combined totalInterestPaid is the sum of every debt's own interest", () => {
    const debts: PlannerDebtInput[] = [
      { id: "a", name: "A", balance: 500, apr: 0, minimumPayment: 500 },
      { id: "b", name: "B", balance: 500, apr: 0, minimumPayment: 500 },
    ];

    const { avalanche } = comparePayoffStrategies(debts, 0);

    expect(avalanche.totalInterestPaid).toBe("0.00");
  });

  it("handles an empty debt list", () => {
    const { avalanche, snowball } = comparePayoffStrategies([], 0);
    expect(avalanche.debts).toEqual([]);
    expect(avalanche.totalMonths).toBe(0);
    expect(snowball.totalInterestPaid).toBe("0.00");
  });
});

describe("projectPayoffDate", () => {
  it("adds whole months and rolls over into the next year", () => {
    const from = new Date(Date.UTC(2026, 10, 15)); // November 2026
    expect(projectPayoffDate(0, from)).toBe("2026-11");
    expect(projectPayoffDate(2, from)).toBe("2027-01");
  });
});
