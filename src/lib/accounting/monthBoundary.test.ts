import { and, eq, gte, lt } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { categories, transactions } from "@/db/schema";
import { recordAllocation, recordExpense } from "./engine";
import {
  createTestAccount,
  createTestCategory,
  createTestUser,
  withRollback,
} from "./testing";

// PROJECT_BRIEF.md: "spending categories carry forward unspent balance;
// goal categories just accumulate" -- i.e. rollover requires no code at
// all, since allocated_balance is a running total that's never reset at a
// month boundary. This test asserts that invariant directly (rather than
// just trusting it holds because nothing resets it), and separately
// confirms month-scoped queries (as src/lib/months/queries.ts performs)
// correctly isolate each month's own transactions by date range.
describe("month-boundary rollover", () => {
  it("carries a category's balance forward across a month boundary instead of resetting it", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "1000.00" });
      const category = await createTestCategory(tx, user.id, { name: "Groceries" });

      await recordAllocation(tx, user.id, {
        categoryId: category.id,
        amount: "300.00",
        date: "2026-01-15",
      });
      await recordExpense(tx, user.id, {
        accountId: account.id,
        categoryId: category.id,
        amount: "100.00",
        date: "2026-01-20",
      });

      const [afterJanuary] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, category.id));
      expect(afterJanuary.allocatedBalance).toBe("200.00");

      // The month boundary itself: no rollover action, no reset -- just
      // more activity dated into February.
      await recordAllocation(tx, user.id, {
        categoryId: category.id,
        amount: "150.00",
        date: "2026-02-01",
      });

      const [afterFebruaryAllocation] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, category.id));
      // January's unspent $200 carried forward and simply accumulated
      // with February's new $150 -- not reset to 0, and not overwritten
      // by the new allocation alone.
      expect(afterFebruaryAllocation.allocatedBalance).toBe("350.00");
    });
  });

  it("scopes monthly totals to each month's own date range", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "1000.00" });
      const category = await createTestCategory(tx, user.id);

      await recordAllocation(tx, user.id, {
        categoryId: category.id,
        amount: "300.00",
        date: "2026-01-15",
      });
      await recordExpense(tx, user.id, {
        accountId: account.id,
        categoryId: category.id,
        amount: "100.00",
        date: "2026-01-20",
      });
      await recordAllocation(tx, user.id, {
        categoryId: category.id,
        amount: "150.00",
        date: "2026-02-01",
      });

      const januaryRows = await tx
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, user.id),
            gte(transactions.date, "2026-01-01"),
            lt(transactions.date, "2026-02-01")
          )
        );
      const februaryRows = await tx
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, user.id),
            gte(transactions.date, "2026-02-01"),
            lt(transactions.date, "2026-03-01")
          )
        );

      expect(januaryRows).toHaveLength(2);
      expect(januaryRows.map((r) => r.amount).sort()).toEqual(["100.00", "300.00"]);
      expect(februaryRows).toHaveLength(1);
      expect(februaryRows[0].amount).toBe("150.00");
    });
  });
});
