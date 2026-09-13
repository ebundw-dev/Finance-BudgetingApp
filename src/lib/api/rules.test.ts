import { asc, and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { allocationRules } from "@/db/schema";
import { ValidationError, NotFoundError } from "@/lib/accounting/errors";
import { createTestCategory, createTestUser, withRollback, type TestTx } from "@/lib/accounting/testing";
import { createRuleSet, parseCreateRuleSetInput, parseUpdateRuleSetInput, updateRuleSet } from "./rules";

// Queries the table directly rather than via src/lib/rules/queries.ts's
// getRuleSet -- that file is marked "server-only" (Next.js's build-time
// guard against a Server Component import leaking into client bundles),
// which throws unconditionally outside of Next's own webpack pipeline,
// vitest included.
async function getRuleSetRows(tx: TestTx, userId: string, ruleName: string) {
  return tx
    .select()
    .from(allocationRules)
    .where(and(eq(allocationRules.userId, userId), eq(allocationRules.ruleName, ruleName)))
    .orderBy(asc(allocationRules.sortOrder));
}

describe("parseCreateRuleSetInput", () => {
  it("rejects a missing name", () => {
    expect(() => parseCreateRuleSetInput({ rows: [] })).toThrow(ValidationError);
  });

  it("rejects fewer than two valid rows", () => {
    expect(() =>
      parseCreateRuleSetInput({ ruleName: "Payout Split", rows: [{ categoryId: "a", percentage: "100" }] })
    ).toThrow(ValidationError);
  });

  it("drops rows with an empty category or non-positive percentage before checking row count", () => {
    expect(() =>
      parseCreateRuleSetInput({
        ruleName: "Payout Split",
        rows: [
          { categoryId: "a", percentage: "50" },
          { categoryId: "b", percentage: "50" },
          { categoryId: "", percentage: "10" },
          { categoryId: "c", percentage: "0" },
        ],
      })
    ).not.toThrow();
  });

  it("rejects percentages that don't sum to 100", () => {
    expect(() =>
      parseCreateRuleSetInput({
        ruleName: "Payout Split",
        rows: [
          { categoryId: "a", percentage: "50" },
          { categoryId: "b", percentage: "40" },
        ],
      })
    ).toThrow(/currently at 90%/);
  });
});

describe("createRuleSet", () => {
  it("inserts one row per category with the given sort order", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const catA = await createTestCategory(tx, user.id, { name: "Rent" });
      const catB = await createTestCategory(tx, user.id, { name: "Savings" });

      const input = parseCreateRuleSetInput({
        ruleName: "Payout Split",
        rows: [
          { categoryId: catA.id, percentage: "60" },
          { categoryId: catB.id, percentage: "40" },
        ],
      });
      const result = await createRuleSet(tx, user.id, input);
      expect(result.name).toBe("Payout Split");

      const rows = await getRuleSetRows(tx, user.id, "Payout Split");
      expect(rows).toHaveLength(2);
      expect(rows[0].percentage).toBe("60.00");
    });
  });

  it("rejects a duplicate name (case-insensitive)", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const catA = await createTestCategory(tx, user.id, { name: "Rent" });
      const catB = await createTestCategory(tx, user.id, { name: "Savings" });
      const rows = [
        { categoryId: catA.id, percentage: "60" },
        { categoryId: catB.id, percentage: "40" },
      ];

      await createRuleSet(tx, user.id, { ruleName: "Payout Split", rows });
      await expect(createRuleSet(tx, user.id, { ruleName: "payout split", rows })).rejects.toThrow(ValidationError);
    });
  });
});

describe("updateRuleSet", () => {
  it("replaces every row", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const catA = await createTestCategory(tx, user.id, { name: "Rent" });
      const catB = await createTestCategory(tx, user.id, { name: "Savings" });
      const catC = await createTestCategory(tx, user.id, { name: "Fun" });

      await createRuleSet(tx, user.id, {
        ruleName: "Payout Split",
        rows: [
          { categoryId: catA.id, percentage: "60" },
          { categoryId: catB.id, percentage: "40" },
        ],
      });

      const input = parseUpdateRuleSetInput({
        rows: [
          { categoryId: catA.id, percentage: "50" },
          { categoryId: catB.id, percentage: "30" },
          { categoryId: catC.id, percentage: "20" },
        ],
      });
      await updateRuleSet(tx, user.id, "Payout Split", input);

      const rows = await getRuleSetRows(tx, user.id, "Payout Split");
      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r.percentage)).toEqual(["50.00", "30.00", "20.00"]);
    });
  });

  it("throws NotFoundError for a nonexistent rule set", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const catA = await createTestCategory(tx, user.id, { name: "Rent" });
      const catB = await createTestCategory(tx, user.id, { name: "Savings" });

      await expect(
        updateRuleSet(tx, user.id, "Nonexistent", {
          rows: [
            { categoryId: catA.id, percentage: "60" },
            { categoryId: catB.id, percentage: "40" },
          ],
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
