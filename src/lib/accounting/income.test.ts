import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { accounts } from "@/db/schema";
import { recordIncome } from "./engine";
import { ValidationError } from "./errors";
import { createTestAccount, createTestUser, withRollback } from "./testing";

describe("recordIncome", () => {
  it("increases the cash account balance and records a ledger entry", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, {
        currentBalance: "100.00",
      });

      const txn = await recordIncome(tx, user.id, {
        accountId: account.id,
        amount: "50.00",
        date: "2026-01-01",
        source: "Paycheck",
      });

      expect(txn.type).toBe("income");
      expect(txn.categoryId).toBeNull();

      const [updated] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, account.id));
      expect(updated.currentBalance).toBe("150.00");
    });
  });

  it("rejects deposits into a non-cash account", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, {
        type: "credit_card",
        isCashAccount: false,
      });

      await expect(
        recordIncome(tx, user.id, {
          accountId: account.id,
          amount: "10.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  it("rejects a zero or negative amount", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id);

      await expect(
        recordIncome(tx, user.id, {
          accountId: account.id,
          amount: "0",
          date: "2026-01-01",
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        recordIncome(tx, user.id, {
          accountId: account.id,
          amount: "-5.00",
          date: "2026-01-01",
        })
      ).rejects.toThrow(ValidationError);
    });
  });
});
