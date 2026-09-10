import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { accounts, categories } from "@/db/schema";
import { recordAllocation, recordIncome } from "./engine";
import { InsufficientUnallocatedCashError, ValidationError } from "./errors";
import {
  createTestAccount,
  createTestCategory,
  createTestUser,
  withRollback,
} from "./testing";

describe("recordAllocation", () => {
  it("moves money from Unallocated Cash into a category without touching accounts", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, {
        currentBalance: "200.00",
      });
      const category = await createTestCategory(tx, user.id);

      const txn = await recordAllocation(tx, user.id, {
        categoryId: category.id,
        amount: "75.00",
        date: "2026-01-01",
      });

      expect(txn.type).toBe("allocation");
      expect(txn.accountId).toBeNull();

      const [updatedAccount] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, account.id));
      const [updatedCategory] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, category.id));

      // Cash on hand is unchanged -- allocation is not income or an expense.
      expect(updatedAccount.currentBalance).toBe("200.00");
      expect(updatedCategory.allocatedBalance).toBe("75.00");
    });
  });

  it("rejects allocating more than is currently unallocated", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await createTestAccount(tx, user.id, { currentBalance: "100.00" });
      const category = await createTestCategory(tx, user.id);

      await expect(
        recordAllocation(tx, user.id, {
          categoryId: category.id,
          amount: "100.01",
          date: "2026-01-01",
        })
      ).rejects.toThrow(InsufficientUnallocatedCashError);
    });
  });

  it("accounts for prior allocations when checking what's available", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await createTestAccount(tx, user.id, { currentBalance: "100.00" });
      const categoryA = await createTestCategory(tx, user.id, { name: "A" });
      const categoryB = await createTestCategory(tx, user.id, { name: "B" });

      await recordAllocation(tx, user.id, {
        categoryId: categoryA.id,
        amount: "60.00",
        date: "2026-01-01",
      });

      // Only $40 of the original $100 is still unallocated.
      await expect(
        recordAllocation(tx, user.id, {
          categoryId: categoryB.id,
          amount: "40.01",
          date: "2026-01-01",
        })
      ).rejects.toThrow(InsufficientUnallocatedCashError);
    });
  });

  it("rejects a zero or negative amount", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await createTestAccount(tx, user.id, { currentBalance: "100.00" });
      const category = await createTestCategory(tx, user.id);

      await expect(
        recordAllocation(tx, user.id, {
          categoryId: category.id,
          amount: "0",
          date: "2026-01-01",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  // Keep recordIncome imported/exercised here too, since allocation only
  // makes sense downstream of income having landed in a cash account.
  it("supports income followed immediately by allocation", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, {
        currentBalance: "0",
      });
      const category = await createTestCategory(tx, user.id);

      await recordIncome(tx, user.id, {
        accountId: account.id,
        amount: "500.00",
        date: "2026-01-01",
      });
      await recordAllocation(tx, user.id, {
        categoryId: category.id,
        amount: "500.00",
        date: "2026-01-01",
      });

      const [updatedCategory] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, category.id));
      expect(updatedCategory.allocatedBalance).toBe("500.00");
    });
  });
});
