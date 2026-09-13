import { and, eq } from "drizzle-orm";
import { allocationRules } from "@/db/schema";
import { percentagesSumTo100 } from "@/lib/accounting/allocationRules";
import { NotFoundError, ValidationError } from "@/lib/accounting/errors";
import type { Tx } from "@/lib/accounting/engine";

export interface RuleSetRowInput {
  categoryId: string;
  percentage: string;
}

export interface RuleSetInput {
  ruleName: string;
  rows: RuleSetRowInput[];
}

function parseRows(value: unknown): RuleSetRowInput[] {
  if (!Array.isArray(value)) {
    throw new ValidationError("rows must be an array of {categoryId, percentage} items.");
  }
  const rows = value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      const categoryId = typeof record.categoryId === "string" ? record.categoryId.trim() : "";
      const percentage = typeof record.percentage === "string" ? record.percentage.trim() : "";
      if (!categoryId || !percentage || Number(percentage) <= 0) return null;
      return { categoryId, percentage };
    })
    .filter((row): row is RuleSetRowInput => row !== null);

  if (rows.length < 2) {
    throw new ValidationError("Add at least two categories.");
  }
  if (!percentagesSumTo100(rows)) {
    const sum = Math.round(rows.reduce((acc, row) => acc + Number(row.percentage), 0) * 100) / 100;
    const diff = Math.round((100 - sum) * 100) / 100;
    const adjustment = diff > 0 ? `add ${diff}% more` : `remove ${Math.abs(diff)}%`;
    throw new ValidationError(`Percentages must sum to 100 -- currently at ${sum}%, ${adjustment}.`);
  }
  return rows;
}

// Mirrors src/lib/rules/actions.ts's createRuleSet validation exactly
// (rows with an empty category or non-positive percentage are dropped
// before checking the ≥2-rows and sum-to-100 rules, same as web's
// filter step) -- a separate copy, not an extracted shared function, so
// the web app's own action file stays untouched. The duplicate-name
// check lives in createRuleSet below (needs a DB read), not here, same
// split as every other parseXInput in this API layer.
export function parseCreateRuleSetInput(body: unknown): RuleSetInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("A JSON request body is required.");
  }
  const record = body as Record<string, unknown>;
  const ruleName = typeof record.ruleName === "string" ? record.ruleName.trim() : "";
  if (!ruleName) {
    throw new ValidationError("Name is required.");
  }
  const rows = parseRows(record.rows);
  return { ruleName, rows };
}

export async function createRuleSet(tx: Tx, userId: string, input: RuleSetInput) {
  // Inlined rather than calling src/lib/rules/queries.ts's
  // listRuleSetNames -- that file is marked "server-only" (a Next.js
  // build-time guard against leaking into client bundles), which
  // vitest's plain Node environment can't satisfy; API route modules
  // shouldn't depend on it anyway; readability, not a rule change.
  const existingRows = await tx
    .selectDistinct({ ruleName: allocationRules.ruleName })
    .from(allocationRules)
    .where(eq(allocationRules.userId, userId));
  if (existingRows.some((row) => row.ruleName.toLowerCase() === input.ruleName.toLowerCase())) {
    throw new ValidationError("A rule set with that name already exists.");
  }

  await tx.insert(allocationRules).values(
    input.rows.map((row, i) => ({
      userId,
      ruleName: input.ruleName,
      categoryId: row.categoryId,
      percentage: row.percentage,
      sortOrder: i,
    }))
  );

  return { name: input.ruleName };
}

export interface UpdateRuleSetInput {
  rows: RuleSetRowInput[];
}

// New: the web app has no rule-set edit flow at all (only create-new or
// delete-whole-set). Mirrors createRuleSet's row validation (≥2 rows,
// sums to 100) but skips the duplicate-name check (editing keeps the
// existing name) and replaces every row -- delete then reinsert -- since
// rows have no stable per-row identity from the client's perspective
// when categories/counts can change entirely between edits.
export function parseUpdateRuleSetInput(body: unknown): UpdateRuleSetInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("A JSON request body is required.");
  }
  const record = body as Record<string, unknown>;
  return { rows: parseRows(record.rows) };
}

export async function updateRuleSet(tx: Tx, userId: string, ruleName: string, input: UpdateRuleSetInput) {
  const existing = await tx
    .select({ id: allocationRules.id })
    .from(allocationRules)
    .where(and(eq(allocationRules.userId, userId), eq(allocationRules.ruleName, ruleName)))
    .limit(1);
  if (existing.length === 0) throw new NotFoundError("Rule set not found.");

  await tx.delete(allocationRules).where(and(eq(allocationRules.userId, userId), eq(allocationRules.ruleName, ruleName)));

  await tx.insert(allocationRules).values(
    input.rows.map((row, i) => ({
      userId,
      ruleName,
      categoryId: row.categoryId,
      percentage: row.percentage,
      sortOrder: i,
    }))
  );

  return { name: ruleName };
}
