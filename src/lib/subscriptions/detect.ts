// Pure recurring-charge / subscription detector -- scans expense history
// for payees that keep charging the same account at a consistent amount
// and interval, without any bank sync. Reuses the Cadence type (and
// computeNextDueDate) from scheduled/cadence.ts rather than inventing new
// cadence semantics: a detected subscription and a manually-scheduled
// transaction mean the same thing once "Track it" turns one into the
// other. No DB access here -- see src/lib/subscriptions/queries.ts for the
// data-fetching side.
import { computeNextDueDate, type Cadence } from "@/lib/scheduled/cadence";

export interface DetectableExpense {
  id: string;
  accountId: string;
  categoryId: string;
  amount: string;
  date: string; // YYYY-MM-DD
  source: string;
}

// A signature to exclude by -- payeeKey must already be normalizePayee(x)
// of the underlying description/payee text (scheduled_transactions.description
// for an existing schedule, or a previously-emitted candidate's payeeKey for
// a dismissal), so matching here is a plain equality check.
export interface ExistingScheduleSignature {
  accountId: string;
  categoryId: string | null;
  payeeKey: string;
}

export interface DismissedSignature {
  accountId: string;
  categoryId: string;
  payeeKey: string;
}

export interface SubscriptionCandidate {
  accountId: string;
  categoryId: string;
  payeeKey: string;
  payee: string;
  averageAmount: string;
  cadence: Cadence;
  occurrenceCount: number;
  lastSeenDate: string;
  nextPredictedDate: string;
  transactionIds: string[];
}

// Only these three cadences are inferred from observed gaps -- "roughly
// weekly/monthly/yearly" per spec. biweekly and custom_days exist on the
// Cadence type for manually-created scheduled transactions but aren't
// classified here; an every-14-days charge just won't qualify as a
// candidate (it doesn't fall in the weekly or monthly window).
const CADENCE_DAY_RANGES: { cadence: Cadence; min: number; max: number }[] = [
  { cadence: "weekly", min: 5, max: 9 },
  { cadence: "monthly", min: 28, max: 33 },
  { cadence: "yearly", min: 350, max: 380 },
];

export function normalizePayee(source: string): string {
  return source.trim().toLowerCase().replace(/\s+/g, " ");
}

function daysBetween(earlier: string, later: string): number {
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function classifyCadence(days: number): Cadence | null {
  for (const range of CADENCE_DAY_RANGES) {
    if (days >= range.min && days <= range.max) return range.cadence;
  }
  return null;
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function amountTolerance(average: number): number {
  return Math.max(average * 0.05, 2);
}

// Greedily clusters date-sorted transactions for one payee+account so a
// gradual price change (a subscription creeping from $15.99 to $17.99)
// stays one candidate, while genuinely different amounts (this month's
// grocery run vs. last month's) split into separate, usually-too-short
// clusters instead of averaging together into a meaningless "candidate".
function clusterByAmount(sorted: DetectableExpense[]): DetectableExpense[][] {
  const clusters: { transactions: DetectableExpense[]; runningTotal: number }[] = [];

  for (const txn of sorted) {
    const amount = Number(txn.amount);
    const current = clusters[clusters.length - 1];
    const currentAverage = current ? current.runningTotal / current.transactions.length : null;

    if (current && currentAverage !== null && Math.abs(amount - currentAverage) <= amountTolerance(currentAverage)) {
      current.transactions.push(txn);
      current.runningTotal += amount;
    } else {
      clusters.push({ transactions: [txn], runningTotal: amount });
    }
  }

  return clusters.map((c) => c.transactions);
}

export function detectRecurringCandidates(
  expenses: DetectableExpense[],
  existingSchedules: ExistingScheduleSignature[],
  dismissed: DismissedSignature[]
): SubscriptionCandidate[] {
  const groups = new Map<string, DetectableExpense[]>();

  for (const txn of expenses) {
    if (!txn.source.trim()) continue;
    const key = `${txn.accountId}::${normalizePayee(txn.source)}`;
    const list = groups.get(key);
    if (list) {
      list.push(txn);
    } else {
      groups.set(key, [txn]);
    }
  }

  const excludedSignatures = new Set(
    [...existingSchedules, ...dismissed].map(
      (s) => `${s.accountId}::${s.payeeKey}::${s.categoryId ?? ""}`
    )
  );

  const candidates: SubscriptionCandidate[] = [];

  for (const [groupKey, txns] of groups) {
    const separatorIndex = groupKey.indexOf("::");
    const accountId = groupKey.slice(0, separatorIndex);
    const payeeKey = groupKey.slice(separatorIndex + 2);
    const sorted = [...txns].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    for (const cluster of clusterByAmount(sorted)) {
      if (cluster.length < 2) continue;

      const gaps: number[] = [];
      for (let i = 1; i < cluster.length; i++) {
        gaps.push(daysBetween(cluster[i - 1].date, cluster[i].date));
      }
      const averageGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
      const cadence = classifyCadence(averageGap);
      if (!cadence) continue;
      // Every individual gap must land in the same cadence bucket as the
      // average, not just the average itself -- otherwise two occurrences
      // 40 days apart and two more 20 days apart could average out to a
      // false "monthly" classification.
      if (!gaps.every((gap) => classifyCadence(gap) === cadence)) continue;

      const categoryId = mostCommon(cluster.map((t) => t.categoryId));
      if (excludedSignatures.has(`${accountId}::${payeeKey}::${categoryId}`)) continue;

      const lastTxn = cluster[cluster.length - 1];
      const averageAmount = (
        cluster.reduce((sum, t) => sum + Number(t.amount), 0) / cluster.length
      ).toFixed(2);

      candidates.push({
        accountId,
        categoryId,
        payeeKey,
        payee: lastTxn.source.trim(),
        averageAmount,
        cadence,
        occurrenceCount: cluster.length,
        lastSeenDate: lastTxn.date,
        nextPredictedDate: computeNextDueDate(lastTxn.date, cadence, null),
        transactionIds: cluster.map((t) => t.id),
      });
    }
  }

  return candidates.sort((a, b) => (a.nextPredictedDate < b.nextPredictedDate ? -1 : 1));
}
