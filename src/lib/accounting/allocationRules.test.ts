import { describe, expect, it } from "vitest";
import { computeRuleSetSplit, percentagesSumTo100 } from "./allocationRules";

describe("computeRuleSetSplit", () => {
  it("splits an amount by percentage, in sortOrder", () => {
    const rows = [
      { categoryId: "a", percentage: "50", sortOrder: 0 },
      { categoryId: "b", percentage: "30", sortOrder: 1 },
      { categoryId: "c", percentage: "20", sortOrder: 2 },
    ];

    const result = computeRuleSetSplit(rows, "1000.00");

    expect(result).toEqual([
      { categoryId: "a", amount: "500.00" },
      { categoryId: "b", amount: "300.00" },
      { categoryId: "c", amount: "200.00" },
    ]);
  });

  it("always sums to exactly the input amount, remainder absorbed by the last row", () => {
    // 100 / 3 = 33.33... for each -- a classic case that doesn't divide evenly.
    const rows = [
      { categoryId: "a", percentage: "33.33", sortOrder: 0 },
      { categoryId: "b", percentage: "33.33", sortOrder: 1 },
      { categoryId: "c", percentage: "33.34", sortOrder: 2 },
    ];

    const result = computeRuleSetSplit(rows, "100.00");
    const total = result.reduce((sum, item) => sum + Number(item.amount), 0);

    expect(total.toFixed(2)).toBe("100.00");
    // The last row (sortOrder 2) absorbs whatever rounding left over.
    expect(result[2].categoryId).toBe("c");
  });

  it("respects sortOrder, not array order, for which row is 'last'", () => {
    const rows = [
      { categoryId: "last", percentage: "33.34", sortOrder: 2 },
      { categoryId: "first", percentage: "33.33", sortOrder: 0 },
      { categoryId: "middle", percentage: "33.33", sortOrder: 1 },
    ];

    const result = computeRuleSetSplit(rows, "100.00");

    expect(result.map((r) => r.categoryId)).toEqual(["first", "middle", "last"]);
  });

  it("throws on an empty rule set", () => {
    expect(() => computeRuleSetSplit([], "100.00")).toThrow();
  });
});

describe("percentagesSumTo100", () => {
  it("accepts percentages summing to exactly 100", () => {
    expect(
      percentagesSumTo100([{ percentage: "40" }, { percentage: "35" }, { percentage: "25" }])
    ).toBe(true);
  });

  it("tolerates tiny floating-point drift", () => {
    expect(
      percentagesSumTo100([{ percentage: "33.33" }, { percentage: "33.33" }, { percentage: "33.34" }])
    ).toBe(true);
  });

  it("rejects percentages that don't sum to 100", () => {
    expect(percentagesSumTo100([{ percentage: "50" }, { percentage: "40" }])).toBe(false);
  });
});
