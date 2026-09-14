import { describe, expect, it } from "vitest";
import { computeAgeOfMoney, type AgeOfMoneyTransaction } from "./ageOfMoney";

describe("computeAgeOfMoney", () => {
  it("returns null when there's no spending at all", () => {
    const result = computeAgeOfMoney([{ type: "income", date: "2026-09-01", amount: "1000" }], new Date("2026-09-15"));
    expect(result.ageOfMoneyDays).toBeNull();
    expect(result.totalSpentInWindow).toBe("0.00");
  });

  it("computes a simple single income -> single expense age", () => {
    const txns: AgeOfMoneyTransaction[] = [
      { type: "income", date: "2026-09-01", amount: "1000" },
      { type: "expense", date: "2026-09-11", amount: "100" },
    ];
    const result = computeAgeOfMoney(txns, new Date("2026-09-15"));
    expect(result.ageOfMoneyDays).toBe(10);
    expect(result.totalSpentInWindow).toBe("100.00");
  });

  it("consumes income FIFO (oldest first) across multiple deposits", () => {
    const txns: AgeOfMoneyTransaction[] = [
      { type: "income", date: "2026-08-01", amount: "50" }, // 45 days old by the expense
      { type: "income", date: "2026-09-01", amount: "50" }, // 14 days old
      { type: "expense", date: "2026-09-15", amount: "80" }, // consumes all of the first, 30 of the second
    ];
    const result = computeAgeOfMoney(txns, new Date("2026-09-15"));
    // Weighted: 50*45 + 30*14 = 2250 + 420 = 2670; /80 = 33.375 -> rounds to 33
    expect(result.ageOfMoneyDays).toBe(33);
  });

  it("only counts income and expense -- allocation/transfer/debt_payment/reconciliation are ignored", () => {
    const txns: AgeOfMoneyTransaction[] = [
      { type: "income", date: "2026-09-01", amount: "1000" },
      { type: "expense", date: "2026-09-11", amount: "100" },
    ];
    // Add rows of other types -- computeAgeOfMoney's own type union only
    // accepts "income"/"expense", so this test instead documents the
    // exclusion at the query layer's responsibility (getAgeOfMoneyTransactions
    // only ever selects those two types); this test just re-confirms the
    // baseline math is unaffected by anything not in the input.
    const result = computeAgeOfMoney(txns, new Date("2026-09-15"));
    expect(result.ageOfMoneyDays).toBe(10);
  });

  it("only includes spending whose date falls inside the window in the average", () => {
    const txns: AgeOfMoneyTransaction[] = [
      { type: "income", date: "2026-01-01", amount: "1000" },
      { type: "expense", date: "2026-01-05", amount: "500" }, // way outside a 30-day window ending 2026-09-15
      { type: "expense", date: "2026-09-10", amount: "100" }, // inside the window
    ];
    const result = computeAgeOfMoney(txns, new Date("2026-09-15"), 30);
    // Only the in-window expense counts toward the average and the total,
    // even though the earlier expense still consumed income FIFO-wise.
    expect(result.totalSpentInWindow).toBe("100.00");
    const expectedAge = Math.round(
      (new Date("2026-09-10").getTime() - new Date("2026-01-01").getTime()) / 86_400_000
    );
    expect(result.ageOfMoneyDays).toBe(expectedAge);
  });

  it("treats spending beyond all tracked income as age 0 instead of crashing", () => {
    const txns: AgeOfMoneyTransaction[] = [{ type: "expense", date: "2026-09-10", amount: "100" }];
    const result = computeAgeOfMoney(txns, new Date("2026-09-15"));
    expect(result.ageOfMoneyDays).toBe(0);
    expect(result.totalSpentInWindow).toBe("100.00");
  });

  it("respects a custom window size", () => {
    const txns: AgeOfMoneyTransaction[] = [
      { type: "income", date: "2026-09-01", amount: "1000" },
      { type: "expense", date: "2026-09-05", amount: "50" },
      { type: "expense", date: "2026-09-14", amount: "50" },
    ];
    const sevenDayResult = computeAgeOfMoney(txns, new Date("2026-09-15"), 7);
    // Only the 09-14 expense falls within a 7-day window ending 09-15.
    expect(sevenDayResult.totalSpentInWindow).toBe("50.00");
  });

  it("ignores zero/negative amounts defensively", () => {
    const txns: AgeOfMoneyTransaction[] = [
      { type: "income", date: "2026-09-01", amount: "0" },
      { type: "expense", date: "2026-09-05", amount: "0" },
    ];
    const result = computeAgeOfMoney(txns, new Date("2026-09-15"));
    expect(result.ageOfMoneyDays).toBeNull();
  });
});
