import { describe, expect, it } from "vitest";
import { transactions, transactionSplits } from "@/db/schema";
import { createTestAccount, createTestCategory, createTestUser, withRollback } from "@/lib/accounting/testing";
import { ValidationError } from "@/lib/accounting/errors";
import { getSpendingForMonth, parseSpendingReportParams } from "./reports";

describe("parseSpendingReportParams", () => {
  it("defaults to the current UTC month/year when absent", () => {
    const now = new Date();
    const params = parseSpendingReportParams(new URLSearchParams());
    expect(params).toEqual({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 });
  });

  it("parses explicit year/month", () => {
    const params = parseSpendingReportParams(new URLSearchParams({ year: "2026", month: "3" }));
    expect(params).toEqual({ year: 2026, month: 3 });
  });

  it("rejects a month outside 1-12", () => {
    expect(() => parseSpendingReportParams(new URLSearchParams({ year: "2026", month: "13" }))).toThrow(
      ValidationError
    );
  });

  it("rejects a non-numeric year", () => {
    expect(() => parseSpendingReportParams(new URLSearchParams({ year: "bogus", month: "3" }))).toThrow(
      ValidationError
    );
  });
});

describe("getSpendingForMonth", () => {
  it("sums non-split expenses by category for the given month, sorted descending", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id);
      const groceries = await createTestCategory(tx, user.id, { name: "Groceries" });
      const gas = await createTestCategory(tx, user.id, { name: "Gas" });

      await tx.insert(transactions).values([
        {
          userId: user.id,
          type: "expense",
          accountId: account.id,
          categoryId: groceries.id,
          amount: "100.00",
          date: "2026-09-05",
        },
        {
          userId: user.id,
          type: "expense",
          accountId: account.id,
          categoryId: groceries.id,
          amount: "50.00",
          date: "2026-09-15",
        },
        {
          userId: user.id,
          type: "expense",
          accountId: account.id,
          categoryId: gas.id,
          amount: "40.00",
          date: "2026-09-10",
        },
        // A different month -- must be excluded from the total.
        {
          userId: user.id,
          type: "expense",
          accountId: account.id,
          categoryId: groceries.id,
          amount: "999.00",
          date: "2026-08-15",
        },
      ]);

      const rows = await getSpendingForMonth(tx, user.id, { year: 2026, month: 9 });

      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ categoryName: "Groceries", total: "150.00" });
      expect(rows[1]).toMatchObject({ categoryName: "Gas", total: "40.00" });
    });
  });

  it("merges split-expense rows into the same category's total", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id);
      const groceries = await createTestCategory(tx, user.id, { name: "Groceries" });

      await tx.insert(transactions).values({
        userId: user.id,
        type: "expense",
        accountId: account.id,
        categoryId: groceries.id,
        amount: "20.00",
        date: "2026-09-01",
      });
      const [split] = await tx
        .insert(transactions)
        .values({
          userId: user.id,
          type: "expense",
          accountId: account.id,
          categoryId: null,
          amount: "30.00",
          date: "2026-09-02",
        })
        .returning();
      await tx.insert(transactionSplits).values({ transactionId: split.id, categoryId: groceries.id, amount: "30.00" });

      const rows = await getSpendingForMonth(tx, user.id, { year: 2026, month: 9 });

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ categoryName: "Groceries", total: "50.00" });
    });
  });

  it("returns an empty array for a month with no expenses", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);

      const rows = await getSpendingForMonth(tx, user.id, { year: 2026, month: 9 });

      expect(rows).toEqual([]);
    });
  });
});
