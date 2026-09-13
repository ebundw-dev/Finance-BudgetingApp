import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { categories, categoryGroups, debts } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/accounting/errors";
import { createTestUser, withRollback } from "@/lib/accounting/testing";
import { createAccount, parseCreateAccountInput, parseUpdateAccountInput, updateAccount } from "./accounts";

describe("parseCreateAccountInput", () => {
  it("rejects a missing name/type", () => {
    expect(() => parseCreateAccountInput({ type: "checking" })).toThrow(ValidationError);
    expect(() => parseCreateAccountInput({ name: "Checking", type: "not-a-type" })).toThrow(ValidationError);
  });

  it("rejects a non-numeric starting balance", () => {
    expect(() => parseCreateAccountInput({ name: "Checking", type: "checking", currentBalance: "abc" })).toThrow(
      ValidationError
    );
  });

  it("defaults currentBalance to 0 and isCashAccount to true", () => {
    const input = parseCreateAccountInput({ name: "Checking", type: "checking" });
    expect(input.currentBalance).toBe("0");
    expect(input.isCashAccount).toBe(true);
    expect(input.isDebt).toBe(false);
  });
});

describe("createAccount", () => {
  it("creates a plain account with no debt row", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createAccount(tx, user.id, {
        name: "Checking",
        type: "checking",
        currentBalance: "100.00",
        isCashAccount: true,
        isDebt: false,
      });

      expect(account.name).toBe("Checking");
      expect(account.currentBalance).toBe("100.00");

      const [debtRow] = await tx.select().from(debts).where(eq(debts.accountId, account.id));
      expect(debtRow).toBeUndefined();
    });
  });

  it("marking isDebt creates a DEBT group, a reserve category, and a debts row", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createAccount(tx, user.id, {
        name: "Visa",
        type: "credit_card",
        currentBalance: "500.00",
        isCashAccount: false,
        isDebt: true,
      });

      const [debtRow] = await tx.select().from(debts).where(eq(debts.accountId, account.id));
      expect(debtRow).toBeDefined();
      expect(debtRow.startingBalance).toBe("500.00");

      const [reserveCategory] = await tx.select().from(categories).where(eq(categories.id, debtRow.categoryId));
      expect(reserveCategory.name).toBe("Visa Reserve");

      const [group] = await tx.select().from(categoryGroups).where(eq(categoryGroups.id, reserveCategory.groupId));
      expect(group.name.toLowerCase()).toBe("debt");
    });
  });

  it("reuses an existing DEBT group instead of creating a duplicate", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const first = await createAccount(tx, user.id, {
        name: "Visa",
        type: "credit_card",
        currentBalance: "100.00",
        isCashAccount: false,
        isDebt: true,
      });
      const second = await createAccount(tx, user.id, {
        name: "Mastercard",
        type: "credit_card",
        currentBalance: "200.00",
        isCashAccount: false,
        isDebt: true,
      });

      const [firstDebt] = await tx.select().from(debts).where(eq(debts.accountId, first.id));
      const [secondDebt] = await tx.select().from(debts).where(eq(debts.accountId, second.id));
      const [firstCategory] = await tx.select().from(categories).where(eq(categories.id, firstDebt.categoryId));
      const [secondCategory] = await tx.select().from(categories).where(eq(categories.id, secondDebt.categoryId));

      expect(firstCategory.groupId).toBe(secondCategory.groupId);
    });
  });
});

describe("parseUpdateAccountInput", () => {
  it("rejects a missing name/type", () => {
    expect(() => parseUpdateAccountInput({ type: "checking" })).toThrow(ValidationError);
  });
});

describe("updateAccount", () => {
  it("updates name/type/isCashAccount", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createAccount(tx, user.id, {
        name: "Checking",
        type: "checking",
        currentBalance: "0",
        isCashAccount: true,
        isDebt: false,
      });

      const updated = await updateAccount(tx, user.id, account.id, {
        name: "Primary Checking",
        type: "savings",
        isCashAccount: false,
      });

      expect(updated.name).toBe("Primary Checking");
      expect(updated.type).toBe("savings");
      expect(updated.isCashAccount).toBe(false);
      // currentBalance is untouched by design -- see updateAccount's comment.
      expect(updated.currentBalance).toBe("0.00");
    });
  });

  it("throws NotFoundError for another user's account", async () => {
    await withRollback(async (tx) => {
      const owner = await createTestUser(tx);
      const intruder = await createTestUser(tx);
      const account = await createAccount(tx, owner.id, {
        name: "Checking",
        type: "checking",
        currentBalance: "0",
        isCashAccount: true,
        isDebt: false,
      });

      await expect(
        updateAccount(tx, intruder.id, account.id, { name: "Hijacked", type: "checking", isCashAccount: true })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
