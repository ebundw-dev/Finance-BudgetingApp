import { describe, expect, it } from "vitest";
import { createTestAccount, createTestCategory, createTestUser, withRollback } from "@/lib/accounting/testing";
import { ValidationError } from "@/lib/accounting/errors";
import { createTransaction, parseCreateTransactionInput } from "./transactions";

describe("parseCreateTransactionInput", () => {
  it("parses a valid expense", () => {
    const input = parseCreateTransactionInput({
      type: "expense",
      accountId: "a1",
      categoryId: "c1",
      amount: "12.34",
      date: "2026-09-12",
      source: "Coffee Shop",
    });
    expect(input).toEqual({
      type: "expense",
      accountId: "a1",
      categoryId: "c1",
      amount: "12.34",
      date: "2026-09-12",
      source: "Coffee Shop",
      notes: undefined,
    });
  });

  it("rejects a missing body", () => {
    expect(() => parseCreateTransactionInput(null)).toThrow(ValidationError);
  });

  it("rejects an unrecognized type", () => {
    expect(() => parseCreateTransactionInput({ type: "bogus", amount: "1", date: "2026-09-12" })).toThrow(
      ValidationError
    );
  });

  it("rejects an expense missing categoryId", () => {
    expect(() =>
      parseCreateTransactionInput({ type: "expense", accountId: "a1", amount: "1", date: "2026-09-12" })
    ).toThrow(ValidationError);
  });

  it("rejects a split_expense with fewer than two splits", () => {
    expect(() =>
      parseCreateTransactionInput({
        type: "split_expense",
        accountId: "a1",
        amount: "10",
        date: "2026-09-12",
        splits: [{ categoryId: "c1", amount: "10" }],
      })
    ).toThrow(ValidationError);
  });

  it("parses a valid split_expense", () => {
    const input = parseCreateTransactionInput({
      type: "split_expense",
      accountId: "a1",
      amount: "10",
      date: "2026-09-12",
      splits: [
        { categoryId: "c1", amount: "6" },
        { categoryId: "c2", amount: "4" },
      ],
    });
    expect(input).toMatchObject({
      type: "split_expense",
      splits: [
        { categoryId: "c1", amount: "6" },
        { categoryId: "c2", amount: "4" },
      ],
    });
  });

  it("parses a valid transfer", () => {
    const input = parseCreateTransactionInput({
      type: "transfer",
      fromAccountId: "a1",
      toAccountId: "a2",
      amount: "50",
      date: "2026-09-12",
    });
    expect(input).toMatchObject({ type: "transfer", fromAccountId: "a1", toAccountId: "a2" });
  });
});

describe("createTransaction", () => {
  it("posts an expense through the accounting engine and tracks the payee", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "100" });
      const category = await createTestCategory(tx, user.id, { allocatedBalance: "50" });

      const txn = await createTransaction(tx, user.id, {
        type: "expense",
        accountId: account.id,
        categoryId: category.id,
        amount: "20",
        date: "2026-09-12",
        source: "Coffee Shop",
      });

      expect(txn.amount).toBe("20.00");
      expect(txn.payeeId).not.toBeNull();
    });
  });

  it("posts income without touching payee tracking", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "0" });

      const txn = await createTransaction(tx, user.id, {
        type: "income",
        accountId: account.id,
        amount: "500",
        date: "2026-09-12",
        source: "Paycheck",
      });

      expect(txn.type).toBe("income");
      expect(txn.payeeId).toBeNull();
    });
  });

  it("posts a transfer between two accounts", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const from = await createTestAccount(tx, user.id, { name: "Checking", currentBalance: "100" });
      const to = await createTestAccount(tx, user.id, { name: "Savings", currentBalance: "0" });

      const txn = await createTransaction(tx, user.id, {
        type: "transfer",
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: "30",
        date: "2026-09-12",
      });

      expect(txn.type).toBe("transfer");
    });
  });

  it("posts a split expense across two categories", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "100" });
      const category1 = await createTestCategory(tx, user.id, { name: "Food", allocatedBalance: "50" });
      const category2 = await createTestCategory(tx, user.id, { name: "Gas", allocatedBalance: "50" });

      const txn = await createTransaction(tx, user.id, {
        type: "split_expense",
        accountId: account.id,
        amount: "30",
        date: "2026-09-12",
        source: "Costco",
        splits: [
          { categoryId: category1.id, amount: "20" },
          { categoryId: category2.id, amount: "10" },
        ],
      });

      expect(txn.categoryId).toBeNull();
      expect(txn.payeeId).not.toBeNull();
    });
  });

  it("rejects an expense against a category with insufficient balance, same as manual entry would", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { currentBalance: "100" });
      const category = await createTestCategory(tx, user.id, { allocatedBalance: "5" });

      await expect(
        createTransaction(tx, user.id, {
          type: "expense",
          accountId: account.id,
          categoryId: category.id,
          amount: "20",
          date: "2026-09-12",
        })
      ).rejects.toThrow();
    });
  });
});
