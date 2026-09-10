import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { accounts, categories } from "@/db/schema";
import { recordExpense } from "./engine";
import { InsufficientCategoryBalanceError, NotFoundError } from "./errors";
import {
  createTestAccount,
  createTestCategory,
  createTestDebt,
  createTestUser,
  withRollback,
} from "./testing";

describe("recordExpense", () => {
  it("cash account: decreases both the account and the category, leaves no debt", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, {
        currentBalance: "300.00",
      });
      const category = await createTestCategory(tx, user.id, {
        allocatedBalance: "100.00",
      });

      const txn = await recordExpense(tx, user.id, {
        accountId: account.id,
        categoryId: category.id,
        amount: "40.00",
        date: "2026-01-01",
        source: "Groceries",
      });

      expect(txn.type).toBe("expense");

      const [updatedAccount] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, account.id));
      const [updatedCategory] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, category.id));

      expect(updatedAccount.currentBalance).toBe("260.00");
      expect(updatedCategory.allocatedBalance).toBe("60.00");
    });
  });

  it("credit card: decreases the spending category, credits the debt's reserve category by the same amount, and never touches cash", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const cashAccount = await createTestAccount(tx, user.id, {
        currentBalance: "500.00",
      });
      const cardAccount = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
        currentBalance: "0",
      });
      const debt = await createTestDebt(tx, user.id, cardAccount.id);
      const category = await createTestCategory(tx, user.id, {
        allocatedBalance: "100.00",
      });

      const txn = await recordExpense(tx, user.id, {
        accountId: cardAccount.id,
        categoryId: category.id,
        amount: "40.00",
        date: "2026-01-01",
        source: "Dinner",
      });

      expect(txn.relatedCategoryId).toBe(debt.categoryId);

      const [updatedCash] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, cashAccount.id));
      const [updatedCard] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, cardAccount.id));
      const [updatedCategory] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, category.id));
      const [reserveCategory] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, debt.categoryId));

      // The trap called out in CLAUDE.md: a card purchase must not touch
      // cash. The spending category absorbs it immediately, and the debt's
      // reserve category picks up the exact same amount -- so the sum of
      // all category balances (and therefore Unallocated Cash) never moves.
      expect(updatedCash.currentBalance).toBe("500.00");
      expect(updatedCard.currentBalance).toBe("40.00");
      expect(updatedCategory.allocatedBalance).toBe("60.00");
      expect(reserveCategory.allocatedBalance).toBe("40.00");
    });
  });

  it("rejects charging a credit card that isn't a tracked debt", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const cardAccount = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
        currentBalance: "0",
      });
      const category = await createTestCategory(tx, user.id, {
        allocatedBalance: "100.00",
      });

      await expect(
        recordExpense(tx, user.id, {
          accountId: cardAccount.id,
          categoryId: category.id,
          amount: "40.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  it("rejects spending more than a category has allocated", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, {
        currentBalance: "300.00",
      });
      const category = await createTestCategory(tx, user.id, {
        allocatedBalance: "20.00",
      });

      await expect(
        recordExpense(tx, user.id, {
          accountId: account.id,
          categoryId: category.id,
          amount: "20.01",
          date: "2026-01-01",
        })
      ).rejects.toThrow(InsufficientCategoryBalanceError);
    });
  });
});
