import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { transactionHistory, transactions } from "@/db/schema";
import {
  deleteTransaction,
  recordExpense,
  recordIncome,
  recordReconciliation,
  recordSplitExpense,
  updateExpense,
  updateSplitExpense,
} from "./engine";
import { createTestAccount, createTestCategory, createTestUser, withRollback } from "./testing";

async function getHistoryFor(tx: Parameters<typeof createTestUser>[0], transactionId: string) {
  return tx
    .select()
    .from(transactionHistory)
    .where(eq(transactionHistory.transactionId, transactionId))
    .orderBy(transactionHistory.changedAt);
}

describe("transaction_history -- updateExpense", () => {
  it("logs an 'updated' row with the correct old/new snapshot", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const food = await createTestCategory(tx, user.id, { name: "Food", allocatedBalance: "200.00" });
      const gas = await createTestCategory(tx, user.id, { name: "Gas", allocatedBalance: "200.00" });

      const txn = await recordExpense(tx, user.id, {
        accountId: account.id,
        categoryId: food.id,
        amount: "40.00",
        date: "2026-01-01",
        source: "Groceries",
      });

      await updateExpense(tx, user.id, {
        transactionId: txn.id,
        categoryId: gas.id,
        amount: "55.00",
        date: "2026-01-02",
        source: "Gas Station",
      });

      const history = await getHistoryFor(tx, txn.id);
      expect(history).toHaveLength(1);
      expect(history[0].action).toBe("updated");
      expect(history[0].userId).toBe(user.id);

      const oldValues = history[0].oldValues as Record<string, unknown>;
      const newValues = history[0].newValues as Record<string, unknown>;
      expect(oldValues.categoryId).toBe(food.id);
      expect(oldValues.amount).toBe("40.00");
      expect(oldValues.source).toBe("Groceries");
      expect(newValues.categoryId).toBe(gas.id);
      expect(newValues.amount).toBe("55.00");
      expect(newValues.source).toBe("Gas Station");
    });
  });

  it("logs a separate history row per edit, in chronological order", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const food = await createTestCategory(tx, user.id, { name: "Food", allocatedBalance: "200.00" });

      const txn = await recordExpense(tx, user.id, {
        accountId: account.id,
        categoryId: food.id,
        amount: "10.00",
        date: "2026-01-01",
      });

      await updateExpense(tx, user.id, { transactionId: txn.id, categoryId: food.id, amount: "20.00", date: "2026-01-01" });
      await updateExpense(tx, user.id, { transactionId: txn.id, categoryId: food.id, amount: "30.00", date: "2026-01-01" });

      const history = await getHistoryFor(tx, txn.id);
      expect(history).toHaveLength(2);
      expect((history[0].oldValues as Record<string, unknown>).amount).toBe("10.00");
      expect((history[0].newValues as Record<string, unknown>).amount).toBe("20.00");
      expect((history[1].oldValues as Record<string, unknown>).amount).toBe("20.00");
      expect((history[1].newValues as Record<string, unknown>).amount).toBe("30.00");
    });
  });
});

describe("transaction_history -- updateSplitExpense", () => {
  it("logs old/new split breakdowns, not just the parent row", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const food = await createTestCategory(tx, user.id, { name: "Food", allocatedBalance: "200.00" });
      const gas = await createTestCategory(tx, user.id, { name: "Gas", allocatedBalance: "200.00" });

      const txn = await recordSplitExpense(tx, user.id, {
        accountId: account.id,
        amount: "30.00",
        date: "2026-01-01",
        splits: [
          { categoryId: food.id, amount: "20.00" },
          { categoryId: gas.id, amount: "10.00" },
        ],
      });

      await updateSplitExpense(tx, user.id, {
        transactionId: txn.id,
        amount: "30.00",
        date: "2026-01-01",
        splits: [
          { categoryId: food.id, amount: "15.00" },
          { categoryId: gas.id, amount: "15.00" },
        ],
      });

      const history = await getHistoryFor(tx, txn.id);
      expect(history).toHaveLength(1);
      const oldValues = history[0].oldValues as { splits: { categoryId: string; amount: string }[] };
      const newValues = history[0].newValues as { splits: { categoryId: string; amount: string }[] };
      expect(oldValues.splits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ categoryId: food.id, amount: "20.00" }),
          expect.objectContaining({ categoryId: gas.id, amount: "10.00" }),
        ])
      );
      expect(newValues.splits).toEqual([
        { categoryId: food.id, amount: "15.00" },
        { categoryId: gas.id, amount: "15.00" },
      ]);
    });
  });
});

describe("transaction_history -- deleteTransaction", () => {
  it("logs a 'deleted' row with a full snapshot and null newValues, for a plain expense", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const food = await createTestCategory(tx, user.id, { name: "Food", allocatedBalance: "200.00" });

      const txn = await recordExpense(tx, user.id, {
        accountId: account.id,
        categoryId: food.id,
        amount: "25.00",
        date: "2026-01-01",
        source: "Diner",
      });

      await deleteTransaction(tx, user.id, txn.id);

      const history = await getHistoryFor(tx, txn.id);
      expect(history).toHaveLength(1);
      expect(history[0].action).toBe("deleted");
      expect(history[0].newValues).toBeNull();
      const oldValues = history[0].oldValues as Record<string, unknown>;
      expect(oldValues.amount).toBe("25.00");
      expect(oldValues.source).toBe("Diner");
    });
  });

  it("logs the split breakdown for a deleted split expense", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const food = await createTestCategory(tx, user.id, { name: "Food", allocatedBalance: "200.00" });
      const gas = await createTestCategory(tx, user.id, { name: "Gas", allocatedBalance: "200.00" });

      const txn = await recordSplitExpense(tx, user.id, {
        accountId: account.id,
        amount: "30.00",
        date: "2026-01-01",
        splits: [
          { categoryId: food.id, amount: "20.00" },
          { categoryId: gas.id, amount: "10.00" },
        ],
      });

      await deleteTransaction(tx, user.id, txn.id);

      const history = await getHistoryFor(tx, txn.id);
      expect(history).toHaveLength(1);
      const oldValues = history[0].oldValues as { splits: { categoryId: string; amount: string }[] };
      expect(oldValues.splits).toHaveLength(2);
    });
  });

  it("logs a 'deleted' row for a non-expense type (income)", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "0" });

      const txn = await recordIncome(tx, user.id, { accountId: account.id, amount: "1000.00", date: "2026-01-01" });
      await deleteTransaction(tx, user.id, txn.id);

      const history = await getHistoryFor(tx, txn.id);
      expect(history).toHaveLength(1);
      expect(history[0].action).toBe("deleted");
      expect((history[0].oldValues as Record<string, unknown>).type).toBe("income");
    });
  });

  it("logs a 'deleted' row for a reconciliation adjustment", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "100.00" });

      const { transaction } = await recordReconciliation(tx, user.id, {
        accountId: account.id,
        statementBalance: "150.00",
      });

      await deleteTransaction(tx, user.id, transaction!.id);

      const history = await getHistoryFor(tx, transaction!.id);
      expect(history).toHaveLength(1);
      expect((history[0].oldValues as Record<string, unknown>).reconciliationDelta).toBe("50.00");
    });
  });

  // The whole point of transaction_history.transaction_id NOT being a
  // foreign key: the audit row must survive the transactions row's own
  // deletion, not disappear or block the delete.
  it("survives after the transactions row itself is gone", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "500.00" });
      const food = await createTestCategory(tx, user.id, { name: "Food", allocatedBalance: "200.00" });

      const txn = await recordExpense(tx, user.id, {
        accountId: account.id,
        categoryId: food.id,
        amount: "25.00",
        date: "2026-01-01",
      });

      await deleteTransaction(tx, user.id, txn.id);

      const [remainingTxn] = await tx
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, txn.id), eq(transactions.userId, user.id)));
      expect(remainingTxn).toBeUndefined();

      const history = await getHistoryFor(tx, txn.id);
      expect(history).toHaveLength(1);
    });
  });
});
