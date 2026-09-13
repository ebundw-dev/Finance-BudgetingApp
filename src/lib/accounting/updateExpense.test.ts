import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { accounts, categories, transactions } from "@/db/schema";
import { recordExpense, updateExpense } from "./engine";
import { InsufficientCategoryBalanceError, NotFoundError, ValidationError } from "./errors";
import {
  createTestAccount,
  createTestCategory,
  createTestDebt,
  createTestUser,
  getUnallocatedCash,
  withRollback,
} from "./testing";

describe("updateExpense", () => {
  it("changes the amount within the same category, adjusting both the category and the cash account", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const checking = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills", allocatedBalance: "300.00" });

      const txn = await recordExpense(tx, user.id, {
        accountId: checking.id,
        categoryId: bills.id,
        amount: "50.00",
        date: "2026-01-01",
        source: "Rent",
      });

      const updated = await updateExpense(tx, user.id, {
        transactionId: txn.id,
        categoryId: bills.id,
        amount: "80.00",
        date: "2026-01-02",
        source: "Rent (corrected)",
      });

      expect(updated.amount).toBe("80.00");
      expect(updated.date).toBe("2026-01-02");
      expect(updated.source).toBe("Rent (corrected)");

      const [category] = await tx.select().from(categories).where(eq(categories.id, bills.id));
      // Started at 300, -50 for the original expense, then edited to -80:
      // net effect is -80 from the original 300.
      expect(category.allocatedBalance).toBe("220.00");

      const [account] = await tx.select().from(accounts).where(eq(accounts.id, checking.id));
      expect(account.currentBalance).toBe("420.00");
    });
  });

  it("moves the expense to a different category, reversing the old and applying the new", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const checking = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills", allocatedBalance: "300.00" });
      const groceries = await createTestCategory(tx, user.id, { name: "Groceries", allocatedBalance: "100.00" });

      const txn = await recordExpense(tx, user.id, {
        accountId: checking.id,
        categoryId: bills.id,
        amount: "50.00",
        date: "2026-01-01",
      });

      await updateExpense(tx, user.id, {
        transactionId: txn.id,
        categoryId: groceries.id,
        amount: "50.00",
        date: "2026-01-01",
      });

      const [billsRow] = await tx.select().from(categories).where(eq(categories.id, bills.id));
      const [groceriesRow] = await tx.select().from(categories).where(eq(categories.id, groceries.id));
      expect(billsRow.allocatedBalance).toBe("300.00"); // fully reversed
      expect(groceriesRow.allocatedBalance).toBe("50.00"); // 100 - 50

      const [account] = await tx.select().from(accounts).where(eq(accounts.id, checking.id));
      expect(account.currentBalance).toBe("450.00"); // amount unchanged, so account unchanged too
    });
  });

  it("keeps the core equation intact for a credit-card expense edit", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const card = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
        currentBalance: "0",
      });
      await createTestDebt(tx, user.id, card.id, { reserveBalance: "200.00" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills", allocatedBalance: "300.00" });

      const before = await getUnallocatedCash(tx, user.id);

      const txn = await recordExpense(tx, user.id, {
        accountId: card.id,
        categoryId: bills.id,
        amount: "60.00",
        date: "2026-01-01",
      });
      expect(await getUnallocatedCash(tx, user.id)).toBe(before);

      await updateExpense(tx, user.id, {
        transactionId: txn.id,
        categoryId: bills.id,
        amount: "90.00",
        date: "2026-01-01",
      });
      // A credit card purchase never moves Unallocated Cash, edited or not.
      expect(await getUnallocatedCash(tx, user.id)).toBe(before);

      const [account] = await tx.select().from(accounts).where(eq(accounts.id, card.id));
      expect(account.currentBalance).toBe("90.00"); // debt owed increased with the edit
    });
  });

  it("rejects editing a split expense", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const checking = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills", allocatedBalance: "100.00" });
      const groceries = await createTestCategory(tx, user.id, { name: "Groceries", allocatedBalance: "100.00" });

      const [splitTxn] = await tx
        .insert(transactions)
        .values({
          userId: user.id,
          type: "expense",
          accountId: checking.id,
          categoryId: null,
          amount: "50.00",
          date: "2026-01-01",
        })
        .returning();

      await expect(
        updateExpense(tx, user.id, {
          transactionId: splitTxn.id,
          categoryId: bills.id,
          amount: "50.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(ValidationError);
      // groceries never used above -- just asserting the category exists for setup symmetry with other tests.
      expect(groceries.name).toBe("Groceries");
    });
  });

  it("rejects a net change that would drive the new category negative", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const checking = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills", allocatedBalance: "100.00" });
      const groceries = await createTestCategory(tx, user.id, { name: "Groceries", allocatedBalance: "10.00" });

      const txn = await recordExpense(tx, user.id, {
        accountId: checking.id,
        categoryId: bills.id,
        amount: "50.00",
        date: "2026-01-01",
      });

      await expect(
        updateExpense(tx, user.id, {
          transactionId: txn.id,
          categoryId: groceries.id,
          amount: "50.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(InsufficientCategoryBalanceError);
    });
  });

  it("throws NotFoundError for another user's transaction", async () => {
    await withRollback(async (tx) => {
      const owner = await createTestUser(tx);
      const intruder = await createTestUser(tx);
      const checking = await createTestAccount(tx, owner.id, { currentBalance: "500.00" });
      const bills = await createTestCategory(tx, owner.id, { name: "Bills", allocatedBalance: "300.00" });

      const txn = await recordExpense(tx, owner.id, {
        accountId: checking.id,
        categoryId: bills.id,
        amount: "50.00",
        date: "2026-01-01",
      });

      await expect(
        updateExpense(tx, intruder.id, {
          transactionId: txn.id,
          categoryId: bills.id,
          amount: "1.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
