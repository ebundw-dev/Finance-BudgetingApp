import { describe, expect, it } from "vitest";
import {
  detectRecurringCandidates,
  normalizePayee,
  type DetectableExpense,
  type DismissedSignature,
  type ExistingScheduleSignature,
} from "./detect";

const ACCOUNT = "11111111-1111-1111-1111-111111111111";
const OTHER_ACCOUNT = "22222222-2222-2222-2222-222222222222";
const CATEGORY = "33333333-3333-3333-3333-333333333333";
const OTHER_CATEGORY = "44444444-4444-4444-4444-444444444444";

let nextId = 1;
function txn(overrides: Partial<DetectableExpense> & Pick<DetectableExpense, "date">): DetectableExpense {
  return {
    id: `txn-${nextId++}`,
    accountId: ACCOUNT,
    categoryId: CATEGORY,
    amount: "15.99",
    source: "Netflix",
    ...overrides,
  };
}

function detect(
  expenses: DetectableExpense[],
  existingSchedules: ExistingScheduleSignature[] = [],
  dismissed: DismissedSignature[] = []
) {
  return detectRecurringCandidates(expenses, existingSchedules, dismissed);
}

describe("normalizePayee", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizePayee("  Netflix   Inc  ")).toBe("netflix inc");
    expect(normalizePayee("NETFLIX")).toBe(normalizePayee("netflix"));
  });
});

describe("detectRecurringCandidates", () => {
  it("detects a monthly subscription with a consistent amount", () => {
    const candidates = detect([
      txn({ date: "2026-07-08" }),
      txn({ date: "2026-08-08" }),
      txn({ date: "2026-09-08" }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      accountId: ACCOUNT,
      categoryId: CATEGORY,
      payee: "Netflix",
      cadence: "monthly",
      occurrenceCount: 3,
      averageAmount: "15.99",
      lastSeenDate: "2026-09-08",
      nextPredictedDate: "2026-10-08",
    });
  });

  it("detects a weekly subscription", () => {
    const candidates = detect([
      txn({ date: "2026-07-03", source: "Meal Kit Box", amount: "45.00" }),
      txn({ date: "2026-07-10", source: "Meal Kit Box", amount: "45.00" }),
      txn({ date: "2026-07-17", source: "Meal Kit Box", amount: "45.00" }),
      txn({ date: "2026-07-24", source: "Meal Kit Box", amount: "45.00" }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].cadence).toBe("weekly");
    expect(candidates[0].occurrenceCount).toBe(4);
    expect(candidates[0].nextPredictedDate).toBe("2026-07-31");
  });

  it("detects a yearly subscription", () => {
    const candidates = detect([
      txn({ date: "2025-09-01", source: "Amazon Prime", amount: "139.00" }),
      txn({ date: "2026-09-05", source: "Amazon Prime", amount: "139.00" }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].cadence).toBe("yearly");
  });

  it("fuzzy-matches payee casing and whitespace without requiring an exact string match", () => {
    const candidates = detect([
      txn({ date: "2026-07-08", source: "netflix" }),
      txn({ date: "2026-08-08", source: "  NETFLIX  " }),
      txn({ date: "2026-09-08", source: "Netflix" }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].occurrenceCount).toBe(3);
  });

  it("tolerates a price increase within 5%/$2 (whichever is larger)", () => {
    const candidates = detect([
      txn({ date: "2026-07-08", amount: "15.99" }),
      txn({ date: "2026-08-08", amount: "15.99" }),
      txn({ date: "2026-09-08", amount: "17.99" }), // +$2.00, exactly at the floor tolerance
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].occurrenceCount).toBe(3);
    expect(candidates[0].averageAmount).toBe("16.66");
  });

  it("splits into separate (too-short) clusters when the amount jumps too much", () => {
    // Grocery-run style: same payee/account/category, but amounts vary far
    // more than a subscription's occasional price bump would.
    const candidates = detect([
      txn({ date: "2026-07-05", source: "Grocery Store", amount: "250.00", categoryId: CATEGORY }),
      txn({ date: "2026-08-06", source: "Grocery Store", amount: "300.00", categoryId: CATEGORY }),
      txn({ date: "2026-09-05", source: "Grocery Store", amount: "140.00", categoryId: CATEGORY }),
    ]);

    expect(candidates).toHaveLength(0);
  });

  it("requires at least 2 occurrences", () => {
    const candidates = detect([txn({ date: "2026-07-08" })]);
    expect(candidates).toHaveLength(0);
  });

  it("rejects an inconsistent interval that doesn't fall in any cadence bucket", () => {
    const candidates = detect([
      txn({ date: "2026-07-01" }),
      txn({ date: "2026-07-15" }), // 14 days -- not weekly (5-9) or monthly (28-33)
    ]);
    expect(candidates).toHaveLength(0);
  });

  it("rejects a cluster whose average lands in a bucket but individual gaps don't", () => {
    const candidates = detect([
      txn({ date: "2026-07-01" }),
      txn({ date: "2026-07-21" }), // 20 days: neither weekly (5-9) nor monthly (28-33)
      txn({ date: "2026-08-30" }), // 40 days: neither weekly nor monthly either
      // average gap is 30 (a "monthly" average), but neither individual gap
      // actually is -- must not be classified as a consistent monthly candidate
    ]);
    expect(candidates).toHaveLength(0);
  });

  it("keeps the same payee on different accounts as separate candidates", () => {
    const candidates = detect([
      txn({ date: "2026-07-08", accountId: ACCOUNT }),
      txn({ date: "2026-08-08", accountId: ACCOUNT }),
      txn({ date: "2026-07-10", accountId: OTHER_ACCOUNT }),
      txn({ date: "2026-08-10", accountId: OTHER_ACCOUNT }),
    ]);

    expect(candidates).toHaveLength(2);
    expect(candidates.map((c) => c.accountId).sort()).toEqual([ACCOUNT, OTHER_ACCOUNT].sort());
  });

  it("uses the most common category across the group's transactions", () => {
    const candidates = detect([
      txn({ date: "2026-07-08", categoryId: CATEGORY }),
      txn({ date: "2026-08-08", categoryId: CATEGORY }),
      txn({ date: "2026-09-08", categoryId: OTHER_CATEGORY }),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].categoryId).toBe(CATEGORY);
  });

  it("ignores transactions with a blank payee", () => {
    const candidates = detect([
      txn({ date: "2026-07-08", source: "  " }),
      txn({ date: "2026-08-08", source: "  " }),
    ]);
    expect(candidates).toHaveLength(0);
  });

  it("excludes a group already tracked as a scheduled transaction", () => {
    const existingSchedules: ExistingScheduleSignature[] = [
      { accountId: ACCOUNT, categoryId: CATEGORY, payeeKey: normalizePayee("Netflix") },
    ];
    const candidates = detect(
      [txn({ date: "2026-07-08" }), txn({ date: "2026-08-08" })],
      existingSchedules
    );
    expect(candidates).toHaveLength(0);
  });

  it("does not exclude on a scheduled entry for a different category", () => {
    const existingSchedules: ExistingScheduleSignature[] = [
      { accountId: ACCOUNT, categoryId: OTHER_CATEGORY, payeeKey: normalizePayee("Netflix") },
    ];
    const candidates = detect(
      [txn({ date: "2026-07-08" }), txn({ date: "2026-08-08" })],
      existingSchedules
    );
    expect(candidates).toHaveLength(1);
  });

  it("excludes a previously dismissed candidate going forward", () => {
    const dismissed: DismissedSignature[] = [
      { accountId: ACCOUNT, categoryId: CATEGORY, payeeKey: normalizePayee("Netflix") },
    ];
    const candidates = detect(
      [txn({ date: "2026-07-08" }), txn({ date: "2026-08-08" })],
      [],
      dismissed
    );
    expect(candidates).toHaveLength(0);
  });

  it("sorts candidates by next predicted date", () => {
    const candidates = detect([
      txn({ date: "2026-07-08", source: "Netflix" }),
      txn({ date: "2026-08-08", source: "Netflix" }), // next predicted 2026-09-08
      txn({ date: "2026-07-01", source: "Spotify", amount: "9.99" }),
      txn({ date: "2026-08-01", source: "Spotify", amount: "9.99" }), // next predicted 2026-09-01
    ]);

    expect(candidates.map((c) => c.payee)).toEqual(["Spotify", "Netflix"]);
  });
});
