import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { closeMonth } from "@/lib/months/actions";
import { getMonthSnapshot, getMonthlyTransactionTotals } from "@/lib/months/queries";

function formatCurrency(amount: string): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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
    <main>
      <p>
        <Link href="/">Dashboard</Link> | <Link href="/progress">Progress</Link>
      </p>
      <h1>
        {MONTH_NAMES[month - 1]} {year}
      </h1>
      <p>
        <Link href={`/monthly?year=${prev.year}&month=${prev.month}`}>&larr; Previous</Link>
        {" | "}
        <Link href={`/monthly?year=${next.year}&month=${next.month}`}>Next &rarr;</Link>
      </p>

      <section>
        <h2>Activity</h2>
        <dl>
          <dt>Income</dt>
          <dd>{formatCurrency(totals.income)}</dd>
          <dt>Spending</dt>
          <dd>{formatCurrency(totals.spending)}</dd>
          <dt>Debt Paid</dt>
          <dd>{formatCurrency(totals.debtPaid)}</dd>
          <dt>Savings (allocated to goals)</dt>
          <dd>{formatCurrency(totals.savings)}</dd>
        </dl>
      </section>

      <section>
        <h2>Snapshot</h2>
        {snapshot ? (
          <>
            <dl>
              <dt>Total Cash</dt>
              <dd>{formatCurrency(snapshot.totalCashSnapshot)}</dd>
              <dt>Unallocated Cash</dt>
              <dd>{formatCurrency(snapshot.unallocatedCashSnapshot)}</dd>
              <dt>Total Debt</dt>
              <dd>{formatCurrency(snapshot.totalDebtSnapshot)}</dd>
            </dl>
            {snapshot.categorySnapshots.length > 0 ? (
              <ul>
                {snapshot.categorySnapshots.map((cs) => (
                  <li key={cs.categoryId}>
                    {cs.categoryName}: {formatCurrency(cs.allocatedBalance)}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p>No snapshot recorded for this month.</p>
        )}
        {isCurrentMonth ? (
          <form action={closeMonth}>
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />
            <button type="submit">
              {snapshot ? "Update snapshot for this month" : "Take snapshot for this month"}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
