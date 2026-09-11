import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { accounts, categories, transactionSplits, transactions } from "@/db/schema";
import { recordSplitExpense, updateSplitExpense } from "./engine";
import {
  InsufficientCategoryBalanceError,
  NotFoundError,
  ValidationError,
} from "./errors";
import {
  createTestAccount,
  createTestCategory,
  createTestDebt,
  createTestUser,
  withRollback,
} from "./testing";

describe("recordSplitExpense", () => {
  it("cash account: decreases each split category and the account by the total, keeps categoryId null on the parent", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "300.00" });
      const groceries = await createTestCategory(tx, user.id, {
        name: "Groceries",
        allocatedBalance: "100.00",
      });
      const household = await createTestCategory(tx, user.id, {
        name: "Household",
        allocatedBalance: "50.00",
      });

      const txn = await recordSplitExpense(tx, user.id, {
        accountId: account.id,
        splits: [
          { categoryId: groceries.id, amount: "30.00" },
          { categoryId: household.id, amount: "20.00" },
        ],
        amount: "50.00",
        date: "2026-01-01",
        source: "Grocery Run",
      });

      expect(txn.type).toBe("expense");
      expect(txn.categoryId).toBeNull();

      const [updatedAccount] = await tx.select().from(accounts).where(eq(accounts.id, account.id));
      const [updatedGroceries] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, groceries.id));
      const [updatedHousehold] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, household.id));
      const splitRows = await tx
        .select()
        .from(transactionSplits)
        .where(eq(transactionSplits.transactionId, txn.id));

      expect(updatedAccount.currentBalance).toBe("250.00");
      expect(updatedGroceries.allocatedBalance).toBe("70.00");
      expect(updatedHousehold.allocatedBalance).toBe("30.00");
      expect(splitRows).toHaveLength(2);
      expect(splitRows.map((r) => r.amount).sort()).toEqual(["20.00", "30.00"]);
    });
  });

  it("credit card: decreases each spending category, credits the reserve category once per split by the same amount, never touches cash", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const cashAccount = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const cardAccount = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
        currentBalance: "0",
      });
      const debt = await createTestDebt(tx, user.id, cardAccount.id);
      const groceries = await createTestCategory(tx, user.id, {
        name: "Groceries",
        allocatedBalance: "100.00",
      });
      const household = await createTestCategory(tx, user.id, {
        name: "Household",
        allocatedBalance: "50.00",
      });

      const txn = await recordSplitExpense(tx, user.id, {
        accountId: cardAccount.id,
        splits: [
          { categoryId: groceries.id, amount: "30.00" },
          { categoryId: household.id, amount: "20.00" },
        ],
        amount: "50.00",
        date: "2026-01-01",
      });

      expect(txn.relatedCategoryId).toBe(debt.categoryId);

      const [updatedCash] = await tx.select().from(accounts).where(eq(accounts.id, cashAccount.id));
      const [updatedCard] = await tx.select().from(accounts).where(eq(accounts.id, cardAccount.id));
      const [reserveCategory] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, debt.categoryId));

      expect(updatedCash.currentBalance).toBe("500.00");
      expect(updatedCard.currentBalance).toBe("50.00");
      expect(reserveCategory.allocatedBalance).toBe("50.00");
    });
  });

  it("rejects when splits don't sum to the transaction amount", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "300.00" });
      const a = await createTestCategory(tx, user.id, { allocatedBalance: "100.00" });
      const b = await createTestCategory(tx, user.id, { allocatedBalance: "100.00" });

      await expect(
        recordSplitExpense(tx, user.id, {
          accountId: account.id,
          splits: [
            { categoryId: a.id, amount: "30.00" },
            { categoryId: b.id, amount: "10.00" },
          ],
          amount: "50.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  it("rejects fewer than two splits", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "300.00" });
      const a = await createTestCategory(tx, user.id, { allocatedBalance: "100.00" });

      await expect(
        recordSplitExpense(tx, user.id, {
          accountId: account.id,
          splits: [{ categoryId: a.id, amount: "50.00" }],
          amount: "50.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  it("rejects the same category twice in one split", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "300.00" });
      const a = await createTestCategory(tx, user.id, { allocatedBalance: "100.00" });

      await expect(
        recordSplitExpense(tx, user.id, {
          accountId: account.id,
          splits: [
            { categoryId: a.id, amount: "30.00" },
            { categoryId: a.id, amount: "20.00" },
          ],
          amount: "50.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  it("rejects when one split category can't cover its own amount, and writes nothing", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "300.00" });
      const a = await createTestCategory(tx, user.id, { allocatedBalance: "100.00" });
      const b = await createTestCategory(tx, user.id, { allocatedBalance: "5.00" });

      await expect(
        recordSplitExpense(tx, user.id, {
          accountId: account.id,
          splits: [
            { categoryId: a.id, amount: "30.00" },
            { categoryId: b.id, amount: "20.00" },
          ],
          amount: "50.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(InsufficientCategoryBalanceError);

      const [updatedA] = await tx.select().from(categories).where(eq(categories.id, a.id));
      expect(updatedA.allocatedBalance).toBe("100.00");
    });
  });
});

describe("updateSplitExpense", () => {
  it("resizes existing split rows and adjusts category balances by the net delta", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "300.00" });
      const groceries = await createTestCategory(tx, user.id, {
        name: "Groceries",
        allocatedBalance: "100.00",
      });
      const household = await createTestCategory(tx, user.id, {
        name: "Household",
        allocatedBalance: "50.00",
      });

      const txn = await recordSplitExpense(tx, user.id, {
        accountId: account.id,
        splits: [
          { categoryId: groceries.id, amount: "30.00" },
          { categoryId: household.id, amount: "20.00" },
        ],
        amount: "50.00",
        date: "2026-01-01",
      });

      await updateSplitExpense(tx, user.id, {
        transactionId: txn.id,
        splits: [
          { categoryId: groceries.id, amount: "10.00" },
          { categoryId: household.id, amount: "40.00" },
        ],
        amount: "50.00",
        date: "2026-01-01",
      });

      const [updatedGroceries] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, groceries.id));
      const [updatedHousehold] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, household.id));
      const [updatedAccount] = await tx.select().from(accounts).where(eq(accounts.id, account.id));

      // Groceries: started 100, -30 then reversed +30 then -10 => 90.
      expect(updatedGroceries.allocatedBalance).toBe("90.00");
      // Household: started 50, -20 then reversed +20 then -40 => 10.
      expect(updatedHousehold.allocatedBalance).toBe("10.00");
      // Total amount unchanged, so account balance shouldn't move again.
      expect(updatedAccount.currentBalance).toBe("250.00");
    });
  });

  it("adds and removes split rows, and changes the total amount", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "300.00" });
      const groceries = await createTestCategory(tx, user.id, {
        name: "Groceries",
        allocatedBalance: "100.00",
      });
      const household = await createTestCategory(tx, user.id, {
        name: "Household",
        allocatedBalance: "50.00",
      });
      const fun = await createTestCategory(tx, user.id, {
        name: "Fun",
        allocatedBalance: "50.00",
      });

      const txn = await recordSplitExpense(tx, user.id, {
        accountId: account.id,
        splits: [
          { categoryId: groceries.id, amount: "30.00" },
          { categoryId: household.id, amount: "20.00" },
        ],
        amount: "50.00",
        date: "2026-01-01",
      });

      // Drop household, add fun, and raise the total to 60.
      const updated = await updateSplitExpense(tx, user.id, {
        transactionId: txn.id,
        splits: [
          { categoryId: groceries.id, amount: "30.00" },
          { categoryId: fun.id, amount: "30.00" },
        ],
        amount: "60.00",
        date: "2026-01-01",
      });

      expect(updated.amount).toBe("60.00");

      const [updatedGroceries] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, groceries.id));
      const [updatedHousehold] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, household.id));
      const [updatedFun] = await tx.select().from(categories).where(eq(categories.id, fun.id));
      const [updatedAccount] = await tx.select().from(accounts).where(eq(accounts.id, account.id));

      expect(updatedGroceries.allocatedBalance).toBe("70.00"); // unchanged net (-30 then +30-30)
      expect(updatedHousehold.allocatedBalance).toBe("50.00"); // fully refunded
      expect(updatedFun.allocatedBalance).toBe("20.00"); // newly spent
      // Cash dropped by the original 50, then by the extra 10 from the amount increase.
      expect(updatedAccount.currentBalance).toBe("240.00");

      const splitRows = await tx
        .select()
        .from(transactionSplits)
        .where(eq(transactionSplits.transactionId, txn.id));
      expect(splitRows).toHaveLength(2);
    });
  });

  it("credit card: adjusts the reserve category by the net delta too", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const cardAccount = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
        currentBalance: "0",
      });
      const debt = await createTestDebt(tx, user.id, cardAccount.id);
      const groceries = await createTestCategory(tx, user.id, {
        name: "Groceries",
        allocatedBalance: "100.00",
      });
      const household = await createTestCategory(tx, user.id, {
        name: "Household",
        allocatedBalance: "50.00",
      });

      const txn = await recordSplitExpense(tx, user.id, {
        accountId: cardAccount.id,
        splits: [
          { categoryId: groceries.id, amount: "30.00" },
          { categoryId: household.id, amount: "20.00" },
        ],
        amount: "50.00",
        date: "2026-01-01",
      });

      await updateSplitExpense(tx, user.id, {
        transactionId: txn.id,
        splits: [
          { categoryId: groceries.id, amount: "40.00" },
          { categoryId: household.id, amount: "20.00" },
        ],
        amount: "60.00",
        date: "2026-01-01",
      });

      const [reserveCategory] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, debt.categoryId));
      const [updatedCard] = await tx.select().from(accounts).where(eq(accounts.id, cardAccount.id));

      expect(reserveCategory.allocatedBalance).toBe("60.00");
      expect(updatedCard.currentBalance).toBe("60.00");
    });
  });

  it("rejects editing a transaction that isn't a split expense", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "300.00" });
      const category = await createTestCategory(tx, user.id, { allocatedBalance: "100.00" });

      const [plainExpense] = await tx
        .insert(transactions)
        .values({
          userId: user.id,
          type: "expense",
          accountId: account.id,
          categoryId: category.id,
          amount: "40.00",
          date: "2026-01-01",
        })
        .returning();

      await expect(
        updateSplitExpense(tx, user.id, {
          transactionId: plainExpense.id,
          splits: [
            { categoryId: category.id, amount: "20.00" },
            { categoryId: category.id, amount: "20.00" },
          ],
          amount: "40.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  it("rejects an unknown transaction id", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const a = await createTestCategory(tx, user.id, { allocatedBalance: "100.00" });
      const b = await createTestCategory(tx, user.id, { allocatedBalance: "100.00" });

      await expect(
        updateSplitExpense(tx, user.id, {
          transactionId: "00000000-0000-0000-0000-000000000000",
          splits: [
            { categoryId: a.id, amount: "20.00" },
            { categoryId: b.id, amount: "20.00" },
          ],
          amount: "40.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
