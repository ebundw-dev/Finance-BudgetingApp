import { describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "@/lib/accounting/errors";
import { createTestAccount, createTestDebt, createTestUser, withRollback } from "@/lib/accounting/testing";
import { parseUpdateDebtInput, updateDebt } from "./debts";

describe("parseUpdateDebtInput", () => {
  it("rejects a missing/negative starting balance", () => {
    expect(() => parseUpdateDebtInput({})).toThrow(ValidationError);
    expect(() => parseUpdateDebtInput({ startingBalance: "-1" })).toThrow(ValidationError);
    expect(() => parseUpdateDebtInput({ startingBalance: "abc" })).toThrow(ValidationError);
  });

  it("rejects a non-numeric minimum payment or APR", () => {
    expect(() => parseUpdateDebtInput({ startingBalance: "100", minimumPayment: "abc" })).toThrow(ValidationError);
    expect(() => parseUpdateDebtInput({ startingBalance: "100", apr: "abc" })).toThrow(ValidationError);
  });

  it("allows a zero starting balance and leaves optional fields null when blank", () => {
    const input = parseUpdateDebtInput({ startingBalance: "0" });
    expect(input.startingBalance).toBe("0");
    expect(input.minimumPayment).toBeNull();
    expect(input.apr).toBeNull();
    expect(input.targetPayoffDate).toBeNull();
  });
});

describe("updateDebt", () => {
  it("updates startingBalance/minimumPayment/apr/targetPayoffDate", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id, { type: "credit_card", isCashAccount: false });
      const debt = await createTestDebt(tx, user.id, account.id, { startingBalance: "500.00" });

      const updated = await updateDebt(tx, user.id, debt.id, {
        startingBalance: "450.00",
        minimumPayment: "25.00",
        apr: "19.99",
        targetPayoffDate: "2027-01-01",
      });

      expect(updated.startingBalance).toBe("450.00");
      expect(updated.minimumPayment).toBe("25.00");
      expect(updated.apr).toBe("19.99");
      expect(updated.targetPayoffDate).toBe("2027-01-01");
    });
  });

  it("throws NotFoundError for another user's debt", async () => {
    await withRollback(async (tx) => {
      const owner = await createTestUser(tx);
      const intruder = await createTestUser(tx);
      const account = await createTestAccount(tx, owner.id, { type: "credit_card", isCashAccount: false });
      const debt = await createTestDebt(tx, owner.id, account.id);

      await expect(
        updateDebt(tx, intruder.id, debt.id, {
          startingBalance: "1.00",
          minimumPayment: null,
          apr: null,
          targetPayoffDate: null,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
