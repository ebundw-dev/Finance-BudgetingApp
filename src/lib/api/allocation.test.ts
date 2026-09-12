import { describe, expect, it } from "vitest";
import {
  createTestAccount,
  createTestCategory,
  createTestUser,
  getUnallocatedCash,
  withRollback,
} from "@/lib/accounting/testing";
import { InsufficientUnallocatedCashError, ValidationError } from "@/lib/accounting/errors";
import { parseSubmitAllocationInput, submitAllocation } from "./allocation";

describe("parseSubmitAllocationInput", () => {
  it("parses a valid body", () => {
    const input = parseSubmitAllocationInput({
      items: [{ categoryId: "c1", amount: "10.00" }],
      date: "2026-09-12",
    });
    expect(input).toEqual({ items: [{ categoryId: "c1", amount: "10.00" }], date: "2026-09-12", notes: undefined });
  });

  it("rejects a missing body", () => {
    expect(() => parseSubmitAllocationInput(null)).toThrow(ValidationError);
  });

  it("rejects an empty items array", () => {
    expect(() => parseSubmitAllocationInput({ items: [] })).toThrow(ValidationError);
  });

  it("rejects an item missing amount", () => {
    expect(() => parseSubmitAllocationInput({ items: [{ categoryId: "c1" }] })).toThrow(ValidationError);
  });
});

describe("submitAllocation", () => {
  it("allocates from Unallocated Cash into the given categories, same as the web form", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      // Unallocated Cash is derived as totalCash - totalAllocated, so
      // there needs to be real cash on hand to allocate from.
      await createTestAccount(tx, user.id, { currentBalance: "100" });
      const category1 = await createTestCategory(tx, user.id, { name: "Food" });
      const category2 = await createTestCategory(tx, user.id, { name: "Gas" });

      const txns = await submitAllocation(tx, user.id, {
        items: [
          { categoryId: category1.id, amount: "30" },
          { categoryId: category2.id, amount: "20" },
        ],
        date: "2026-09-12",
      });

      expect(txns).toHaveLength(2);
      expect(await getUnallocatedCash(tx, user.id)).toBe("50.00");
    });
  });

  it("rejects allocating more than Unallocated Cash, same as manual entry would", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await createTestAccount(tx, user.id, { currentBalance: "10" });
      const category = await createTestCategory(tx, user.id);

      await expect(
        submitAllocation(tx, user.id, { items: [{ categoryId: category.id, amount: "50" }], date: "2026-09-12" })
      ).rejects.toThrow(InsufficientUnallocatedCashError);
    });
  });
});
