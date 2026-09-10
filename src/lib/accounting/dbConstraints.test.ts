import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { categories, transactions } from "@/db/schema";
import {
  createTestAccount,
  createTestCategory,
  createTestUser,
  expectDbError,
  withRollback,
} from "./testing";

// These tests bypass src/lib/accounting/engine.ts entirely and write to the
// tables directly, to prove the invariants hold at the database level --
// independent of the service layer, and of any bug it might have.
describe("database-level constraints", () => {
  it("rejects a category allocated_balance going negative via a direct write", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const category = await createTestCategory(tx, user.id, {
        allocatedBalance: "10.00",
      });

      await expectDbError(
        tx
          .update(categories)
          .set({ allocatedBalance: "-0.01" })
          .where(eq(categories.id, category.id)),
        /allocated_balance_non_negative/
      );
    });
  });

  it("rejects a transaction with a non-positive amount via a direct write", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id);

      await expectDbError(
        tx.insert(transactions).values({
          userId: user.id,
          type: "income",
          accountId: account.id,
          amount: "0",
          date: "2026-01-01",
        }),
        /amount_positive/
      );
    });
  });

  it("rejects allocated balances exceeding cash on hand, even bypassing recordAllocation entirely", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await createTestAccount(tx, user.id, { currentBalance: "100.00" });
      const category = await createTestCategory(tx, user.id, {
        allocatedBalance: "0",
      });

      // Simulate a bug in application code: write straight to the
      // category's balance, skipping recordAllocation's own check entirely.
      await tx
        .update(categories)
        .set({ allocatedBalance: "150.00" })
        .where(eq(categories.id, category.id));

      // The guard is a DEFERRABLE INITIALLY DEFERRED constraint trigger, so
      // it only evaluates at COMMIT. Force it to run now, inside this
      // still-open (and still-to-be-rolled-back) transaction, to prove the
      // database itself refuses this state.
      await expectDbError(
        tx.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`),
        /[Uu]nallocated cash would go negative/
      );
    });
  });

  it("allows a category reallocation's intermediate state without a false positive", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await createTestAccount(tx, user.id, { currentBalance: "100.00" });
      const from = await createTestCategory(tx, user.id, {
        name: "From",
        allocatedBalance: "100.00",
      });
      const to = await createTestCategory(tx, user.id, {
        name: "To",
        allocatedBalance: "0",
      });

      // Increment the destination before decrementing the source -- total
      // allocated briefly exceeds cash on hand between these two
      // statements. The deferred trigger must not fire on this
      // intermediate state, only on the final one at COMMIT.
      await tx
        .update(categories)
        .set({ allocatedBalance: "50.00" })
        .where(eq(categories.id, to.id));
      await tx
        .update(categories)
        .set({ allocatedBalance: "50.00" })
        .where(eq(categories.id, from.id));

      await expect(
        tx.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`)
      ).resolves.toBeDefined();
    });
  });
});
