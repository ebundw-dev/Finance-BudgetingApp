// Pure "Age of Money" calculation -- no DB access, same rationale as
// allocationRules.ts and categories/targets.ts. Roughly: how many days
// old, on average, is the money you're spending today? Modeled the same
// way YNAB's own metric works: a FIFO ledger of cash coming in (income),
// with every dollar spent (expense) consuming the OLDEST available
// income dollars first. The "age" of a spent dollar is the gap between
// when the income it came from arrived and when it was spent.
//
// Only income/expense participate: allocation and category_reallocation
// never touch cash at all: transfer is cash-account-to-cash-account so
// it nets to zero for a pool tracked in aggregate; debt_payment isn't
// "spending" by CLAUDE.md's own definition (the spend was already
// counted at purchase time via the credit-card reserve mechanic);
// reconciliation is a manual correction for untracked drift, not a
// meaningful "when did this arrive" data point. This is the "roughly"
// simplification the feature was explicitly scoped to allow.
export interface AgeOfMoneyTransaction {
  type: "income" | "expense";
  date: string; // YYYY-MM-DD
  amount: string;
}

export interface AgeOfMoneyResult {
  // null means there was no spending in the window to measure (e.g. a
  // brand new budget, or the window fell entirely before any expense).
  ageOfMoneyDays: number | null;
  windowDays: number;
  totalSpentInWindow: string;
}

const DEFAULT_WINDOW_DAYS = 30;
const EPSILON = 0.005;

function daysBetween(earlier: string, later: string): number {
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeAgeOfMoney(
  transactions: AgeOfMoneyTransaction[],
  asOf: Date = new Date(),
  windowDays: number = DEFAULT_WINDOW_DAYS
): AgeOfMoneyResult {
  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const windowStartDate = new Date(asOf.getTime() - windowDays * 86_400_000);
  const windowStart = toDateString(windowStartDate);
  const windowEnd = toDateString(asOf);

  // Chronological queue of not-yet-spent income chunks -- shift() pops the
  // oldest (FIFO), matching "the money that's been sitting longest gets
  // spent first" which is what the metric is actually measuring.
  const inflowQueue: { date: string; remaining: number }[] = [];

  let weightedAgeSum = 0;
  let totalSpentInWindow = 0;

  for (const txn of sorted) {
    const amount = Number(txn.amount);
    if (amount <= EPSILON) continue;

    if (txn.type === "income") {
      inflowQueue.push({ date: txn.date, remaining: amount });
      continue;
    }

    // expense
    let remainingToCover = amount;
    const inWindow = txn.date >= windowStart && txn.date <= windowEnd;

    while (remainingToCover > EPSILON) {
      const chunk = inflowQueue[0];
      if (!chunk) {
        // Spending exceeds every tracked income dollar so far (e.g. a
        // pre-existing balance from before the user started using the
        // app) -- there's no origin date to measure, so this remainder
        // contributes age 0 rather than under- or overcounting.
        if (inWindow) totalSpentInWindow += remainingToCover;
        remainingToCover = 0;
        break;
      }

      const consumed = Math.min(chunk.remaining, remainingToCover);
      if (inWindow) {
        weightedAgeSum += daysBetween(chunk.date, txn.date) * consumed;
        totalSpentInWindow += consumed;
      }
      chunk.remaining -= consumed;
      remainingToCover -= consumed;
      if (chunk.remaining <= EPSILON) inflowQueue.shift();
    }
  }

  if (totalSpentInWindow <= EPSILON) {
    return { ageOfMoneyDays: null, windowDays, totalSpentInWindow: "0.00" };
  }

  return {
    ageOfMoneyDays: Math.round(weightedAgeSum / totalSpentInWindow),
    windowDays,
    totalSpentInWindow: totalSpentInWindow.toFixed(2),
  };
}
