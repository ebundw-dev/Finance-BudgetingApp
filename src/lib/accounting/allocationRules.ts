// Pure math for Auto-Allocate: no DB access, just the percentage-split
// computation, kept separate from engine.ts so it's trivially unit
// testable without a database. Callers pass the result to
// recordBulkAllocation to actually apply it.

export interface RuleSetRow {
  categoryId: string;
  percentage: string;
  sortOrder: number;
}

export interface AllocationSplitItem {
  categoryId: string;
  amount: string;
}

// Every row but the last gets floor(total * percentage) to the cent; the
// last row (by sortOrder) absorbs whatever's left, so the split always
// sums to exactly `totalAmount` regardless of rounding -- per CLAUDE.md /
// PROJECT_BRIEF.md's Auto-Allocate spec.
export function computeRuleSetSplit(
  rows: RuleSetRow[],
  totalAmount: string
): AllocationSplitItem[] {
  if (rows.length === 0) {
    throw new Error("Rule set has no rows to apply.");
  }

  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  const total = Number(totalAmount);

  const results: AllocationSplitItem[] = [];
  let runningTotal = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const row = sorted[i];
    const share = Math.floor(total * (Number(row.percentage) / 100) * 100) / 100;
    results.push({ categoryId: row.categoryId, amount: share.toFixed(2) });
    runningTotal += share;
  }

  const last = sorted[sorted.length - 1];
  const remainder = Number((total - runningTotal).toFixed(2));
  results.push({ categoryId: last.categoryId, amount: remainder.toFixed(2) });

  return results;
}

export function percentagesSumTo100(rows: { percentage: string }[]): boolean {
  const sum = rows.reduce((acc, row) => acc + Number(row.percentage), 0);
  return Math.abs(sum - 100) < 0.01;
}
