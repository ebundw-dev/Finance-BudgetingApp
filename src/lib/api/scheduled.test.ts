import { describe, expect, it } from "vitest";
import { createTestAccount, createTestCategory, createTestUser, withRollback } from "@/lib/accounting/testing";
import { ValidationError } from "@/lib/accounting/errors";
import { createScheduled, parseCreateScheduledInput } from "./scheduled";

describe("parseCreateScheduledInput", () => {
  it("parses a valid expense", () => {
    const input = parseCreateScheduledInput({
      type: "expense",
      description: "Netflix",
      amount: "15.99",
      cadence: "monthly",
      nextDueDate: "2026-10-01",
      accountId: "a1",
      categoryId: "c1",
    });
    expect(input).toEqual({
      type: "expense",
      description: "Netflix",
      amount: "15.99",
      cadence: "monthly",
      nextDueDate: "2026-10-01",
      accountId: "a1",
      categoryId: "c1",
      relatedAccountId: null,
      relatedCategoryId: null,
      intervalDays: null,
    });
  });

  it("rejects a missing body", () => {
    expect(() => parseCreateScheduledInput(null)).toThrow(ValidationError);
  });

  it("rejects an invalid type", () => {
    expect(() =>
      parseCreateScheduledInput({
        type: "bogus",
        description: "x",
        amount: "1",
        cadence: "monthly",
        nextDueDate: "2026-10-01",
      })
    ).toThrow(ValidationError);
  });

  it("rejects an invalid cadence", () => {
    expect(() =>
      parseCreateScheduledInput({
        type: "income",
        description: "x",
        amount: "1",
        cadence: "bogus",
        nextDueDate: "2026-10-01",
        accountId: "a1",
      })
    ).toThrow(ValidationError);
  });

  it("rejects a non-positive amount", () => {
    expect(() =>
      parseCreateScheduledInput({
        type: "income",
        description: "x",
        amount: "0",
        cadence: "monthly",
        nextDueDate: "2026-10-01",
        accountId: "a1",
      })
    ).toThrow(ValidationError);
  });

  it("rejects an expense missing accountId/categoryId", () => {
    expect(() =>
      parseCreateScheduledInput({
        type: "expense",
        description: "x",
        amount: "1",
        cadence: "monthly",
        nextDueDate: "2026-10-01",
      })
    ).toThrow(ValidationError);
  });

  it("rejects an income missing accountId", () => {
    expect(() =>
      parseCreateScheduledInput({
        type: "income",
        description: "x",
        amount: "1",
        cadence: "monthly",
        nextDueDate: "2026-10-01",
      })
    ).toThrow(ValidationError);
  });

  it("rejects custom_days cadence without a positive intervalDays", () => {
    expect(() =>
      parseCreateScheduledInput({
        type: "income",
        description: "x",
        amount: "1",
        cadence: "custom_days",
        nextDueDate: "2026-10-01",
        accountId: "a1",
      })
    ).toThrow(ValidationError);
  });

  it("accepts custom_days with a positive intervalDays", () => {
    const input = parseCreateScheduledInput({
      type: "income",
      description: "x",
      amount: "1",
      cadence: "custom_days",
      intervalDays: 10,
      nextDueDate: "2026-10-01",
      accountId: "a1",
    });
    expect(input.intervalDays).toBe(10);
  });
});

describe("createScheduled", () => {
  it("inserts a new scheduled transaction row", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const account = await createTestAccount(tx, user.id);
      const category = await createTestCategory(tx, user.id);

      const created = await createScheduled(tx, user.id, {
        type: "expense",
        accountId: account.id,
        relatedAccountId: null,
        categoryId: category.id,
        relatedCategoryId: null,
        amount: "9.99",
        description: "Spotify",
        cadence: "monthly",
        intervalDays: null,
        nextDueDate: "2026-10-05",
      });

      expect(created.description).toBe("Spotify");
      expect(created.amount).toBe("9.99");
      expect(created.userId).toBe(user.id);
      expect(created.isActive).toBe(true);
    });
  });
});
