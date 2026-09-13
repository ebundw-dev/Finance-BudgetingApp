import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { accounts, categories, transactionSplits, transactions } from "@/db/schema";
import {
  deleteTransaction,
  recordAllocation,
  recordCategoryReallocation,
  recordDebtPayment,
  recordExpense,
  recordIncome,
  recordSplitExpense,
  recordTransfer,
} from "./engine";
import { InsufficientCategoryBalanceError, NotFoundError } from "./errors";
import {
  createTestAccount,
  createTestCategory,
  createTestDebt,
  createTestUser,
  getUnallocatedCash,
  withRollback,
} from "./testing";

describe("deleteTransaction", () => {
  it("reverses a plain cash expense", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const checking = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills", allocatedBalance: "300.00" });

      const txn = await recordExpense(tx, user.id, {
        accountId: checking.id,
        categoryId: bills.id,
        amount: "50.00",
        date: "2026-01-01",
      });

      const result = await deleteTransaction(tx, user.id, txn.id);
      expect(result.deleted).toBe(true);

      const [account] = await tx.select().from(accounts).where(eq(accounts.id, checking.id));
      const [category] = await tx.select().from(categories).where(eq(categories.id, bills.id));
      expect(account.currentBalance).toBe("500.00");
      expect(category.allocatedBalance).toBe("300.00");

      const [remaining] = await tx.select().from(transactions).where(eq(transactions.id, txn.id));
      expect(remaining).toBeUndefined();
    });
  });

  it("reverses a credit-card expense without moving Unallocated Cash", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const card = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
        currentBalance: "0",
      });
      await createTestDebt(tx, user.id, card.id, { reserveBalance: "0" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills", allocatedBalance: "300.00" });

      const before = await getUnallocatedCash(tx, user.id);
      const txn = await recordExpense(tx, user.id, {
        accountId: card.id,
        categoryId: bills.id,
        amount: "60.00",
        date: "2026-01-01",
      });
      expect(await getUnallocatedCash(tx, user.id)).toBe(before);

      await deleteTransaction(tx, user.id, txn.id);
      expect(await getUnallocatedCash(tx, user.id)).toBe(before);

      const [account] = await tx.select().from(accounts).where(eq(accounts.id, card.id));
      const [category] = await tx.select().from(categories).where(eq(categories.id, bills.id));
      expect(account.currentBalance).toBe("0.00");
      expect(category.allocatedBalance).toBe("300.00");
    });
  });

  it("reverses a split expense and removes its transaction_splits rows", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const checking = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills", allocatedBalance: "100.00" });
      const groceries = await createTestCategory(tx, user.id, { name: "Groceries", allocatedBalance: "100.00" });

      const txn = await recordSplitExpense(tx, user.id, {
        accountId: checking.id,
        splits: [
          { categoryId: bills.id, amount: "30.00" },
          { categoryId: groceries.id, amount: "20.00" },
        ],
        amount: "50.00",
        date: "2026-01-01",
      });

      await deleteTransaction(tx, user.id, txn.id);

      const [billsRow] = await tx.select().from(categories).where(eq(categories.id, bills.id));
      const [groceriesRow] = await tx.select().from(categories).where(eq(categories.id, groceries.id));
      expect(billsRow.allocatedBalance).toBe("100.00");
      expect(groceriesRow.allocatedBalance).toBe("100.00");

      const [account] = await tx.select().from(accounts).where(eq(accounts.id, checking.id));
      expect(account.currentBalance).toBe("500.00");

      const remainingSplits = await tx
        .select()
        .from(transactionSplits)
        .where(eq(transactionSplits.transactionId, txn.id));
      expect(remainingSplits).toHaveLength(0);
    });
  });

  it("reverses income", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const checking = await createTestAccount(tx, user.id, { currentBalance: "100.00" });

      const txn = await recordIncome(tx, user.id, { accountId: checking.id, amount: "50.00", date: "2026-01-01" });
      await deleteTransaction(tx, user.id, txn.id);

      const [account] = await tx.select().from(accounts).where(eq(accounts.id, checking.id));
      expect(account.currentBalance).toBe("100.00");
    });
  });

  it("reverses a transfer", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const checking = await createTestAccount(tx, user.id, { name: "Checking", currentBalance: "500.00" });
      const savings = await createTestAccount(tx, user.id, { name: "Savings", currentBalance: "0" });

      const txn = await recordTransfer(tx, user.id, {
        fromAccountId: checking.id,
        toAccountId: savings.id,
        amount: "100.00",
        date: "2026-01-01",
      });
      await deleteTransaction(tx, user.id, txn.id);

      const [checkingRow] = await tx.select().from(accounts).where(eq(accounts.id, checking.id));
      const [savingsRow] = await tx.select().from(accounts).where(eq(accounts.id, savings.id));
      expect(checkingRow.currentBalance).toBe("500.00");
      expect(savingsRow.currentBalance).toBe("0.00");
    });
  });

  it("reverses a debt payment, restoring the reserve category and the debt balance", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const checking = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const card = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
        currentBalance: "60.00",
      });
      const debt = await createTestDebt(tx, user.id, card.id, { reserveBalance: "60.00" });

      const txn = await recordDebtPayment(tx, user.id, {
        fromAccountId: checking.id,
        debtAccountId: card.id,
        amount: "60.00",
        date: "2026-01-01",
      });
      await deleteTransaction(tx, user.id, txn.id);

      const [checkingRow] = await tx.select().from(accounts).where(eq(accounts.id, checking.id));
      const [cardRow] = await tx.select().from(accounts).where(eq(accounts.id, card.id));
      const [reserveRow] = await tx.select().from(categories).where(eq(categories.id, debt.categoryId));
      expect(checkingRow.currentBalance).toBe("500.00");
      expect(cardRow.currentBalance).toBe("60.00");
      expect(reserveRow.allocatedBalance).toBe("60.00");
    });
  });

  it("reverses a category reallocation", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const bills = await createTestCategory(tx, user.id, { name: "Bills", allocatedBalance: "100.00" });
      const emergency = await createTestCategory(tx, user.id, { name: "Emergency", allocatedBalance: "50.00" });

      const txn = await recordCategoryReallocation(tx, user.id, {
        fromCategoryId: bills.id,
        toCategoryId: emergency.id,
        amount: "40.00",
        date: "2026-01-01",
      });
      await deleteTransaction(tx, user.id, txn.id);

      const [billsRow] = await tx.select().from(categories).where(eq(categories.id, bills.id));
      const [emergencyRow] = await tx.select().from(categories).where(eq(categories.id, emergency.id));
      expect(billsRow.allocatedBalance).toBe("100.00");
      expect(emergencyRow.allocatedBalance).toBe("50.00");
    });
  });

  it("rejects deleting a category_reallocation whose destination category has since been spent down", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const checking = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills", allocatedBalance: "100.00" });
      const emergency = await createTestCategory(tx, user.id, { name: "Emergency", allocatedBalance: "50.00" });

      const txn = await recordCategoryReallocation(tx, user.id, {
        fromCategoryId: bills.id,
        toCategoryId: emergency.id,
        amount: "40.00",
        date: "2026-01-01",
      });
      // Spend most of what reallocation added, so reversing it would drive
      // Emergency negative.
      await recordExpense(tx, user.id, {
        accountId: checking.id,
        categoryId: emergency.id,
        amount: "80.00",
        date: "2026-01-02",
      });

      await expect(deleteTransaction(tx, user.id, txn.id)).rejects.toThrow(InsufficientCategoryBalanceError);
    });
  });

  it("reverses an allocation", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      // Just needs to exist so there's cash available to allocate --
      // recordAllocation itself never touches an account.
      await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const bills = await createTestCategory(tx, user.id, { name: "Bills", allocatedBalance: "0.00" });

      const before = await getUnallocatedCash(tx, user.id);
      const txn = await recordAllocation(tx, user.id, { categoryId: bills.id, amount: "100.00", date: "2026-01-01" });
      expect(await getUnallocatedCash(tx, user.id)).toBe((Number(before) - 100).toFixed(2));

      await deleteTransaction(tx, user.id, txn.id);
      expect(await getUnallocatedCash(tx, user.id)).toBe(before);

      const [billsRow] = await tx.select().from(categories).where(eq(categories.id, bills.id));
      expect(billsRow.allocatedBalance).toBe("0.00");
    });
  });

  it("throws NotFoundError for another user's transaction", async () => {
    await withRollback(async (tx) => {
      const owner = await createTestUser(tx);
      const intruder = await createTestUser(tx);
      const checking = await createTestAccount(tx, owner.id, { currentBalance: "100.00" });

      const txn = await recordIncome(tx, owner.id, { accountId: checking.id, amount: "50.00", date: "2026-01-01" });

      await expect(deleteTransaction(tx, intruder.id, txn.id)).rejects.toThrow(NotFoundError);
    });
  });
});
