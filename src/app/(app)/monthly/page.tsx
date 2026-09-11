import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { closeMonth } from "@/lib/months/actions";
import { getMonthSnapshot, getMonthlyTransactionTotals } from "@/lib/months/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonPrimary, buttonSecondary, currency } from "@/lib/ui";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = month - 1 + delta;
  const newYear = year + Math.floor(zeroBased / 12);
  const newMonth = ((zeroBased % 12) + 12) % 12;
  return { year: newYear, month: newMonth + 1 };
}

export default async function MonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { userId } = await verifySession();
  const params = await searchParams;

  const now = new Date();
  const year = params.year ? Number(params.year) : now.getUTCFullYear();
  const month = params.month ? Number(params.month) : now.getUTCMonth() + 1;
  const isCurrentMonth = year === now.getUTCFullYear() && month === now.getUTCMonth() + 1;

  const [totals, snapshot] = await Promise.all([
    getMonthlyTransactionTotals(userId, year, month),
    getMonthSnapshot(userId, year, month),
  ]);

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="A month at a time"
          title={`${MONTH_NAMES[month - 1]} ${year}.`}
          subtitle="Look back before you look forward."
        />
        <div className="mt-1 flex gap-2">
          <Link href={`/monthly?year=${prev.year}&month=${prev.month}`} className={buttonSecondary}>
            &larr; Previous
          </Link>
          <Link href={`/monthly?year=${next.year}&month=${next.month}`} className={buttonSecondary}>
            Next &rarr;
          </Link>
        </div>
      </div>

      <h2 className="mb-4 text-sm font-medium tracking-wide text-text-secondary uppercase">
        Activity
      </h2>
      <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Income" value={currency(totals.income)} tone="success" />
        <StatCard label="Spending" value={currency(totals.spending)} tone="warning" />
        <StatCard label="Debt Paid" value={currency(totals.debtPaid)} tone="accent" />
        <StatCard label="Savings" value={currency(totals.savings)} tone="info" />
      </div>

      <h2 className="mb-4 text-sm font-medium tracking-wide text-text-secondary uppercase">
        Snapshot
      </h2>
      <Card>
        {snapshot ? (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <div className="text-xs text-text-secondary">Total Cash</div>
                <div className="tabular-nums text-lg font-semibold text-text">
                  {currency(snapshot.totalCashSnapshot)}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-secondary">Unallocated Cash</div>
                <div className="tabular-nums text-lg font-semibold text-text">
                  {currency(snapshot.unallocatedCashSnapshot)}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-secondary">Total Debt</div>
                <div className="tabular-nums text-lg font-semibold text-danger">
                  {currency(snapshot.totalDebtSnapshot)}
                </div>
              </div>
            </div>
            {snapshot.categorySnapshots.length > 0 ? (
              <ul className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
                {snapshot.categorySnapshots.map((cs) => (
                  <li key={cs.categoryId} className="flex justify-between">
                    <span className="text-text-secondary">{cs.categoryName}</span>
                    <span className="tabular-nums text-text">{currency(cs.allocatedBalance)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-text-muted">No snapshot recorded for this month.</p>
        )}
        {isCurrentMonth ? (
          <form action={closeMonth} className="mt-4">
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />
            <SubmitButton className={buttonPrimary} pendingLabel="Saving snapshot…">
              {snapshot ? "Update snapshot for this month" : "Take snapshot for this month"}
            </SubmitButton>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
