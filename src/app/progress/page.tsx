import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { getProgressData } from "@/lib/months/queries";

function formatCurrency(amount: string): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function ProgressPage() {
  const { userId } = await verifySession();
  const rows = await getProgressData(userId);

  const categoryNames = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row.categoryBalances)))
  );

  return (
    <main>
      <p>
        <Link href="/">Dashboard</Link> | <Link href="/monthly">Monthly View</Link>
      </p>
      <h1>Progress</h1>
      <p>
        Built from snapshots taken via the monthly view&apos;s &quot;Take snapshot&quot; button --
        no data appears here until at least one month has been snapshotted. Shown as a table for
        now; visual charts are a later polish pass.
      </p>
      {rows.length === 0 ? (
        <p>
          No snapshots yet. Go to <Link href="/monthly">Monthly View</Link> and take one for the
          current month.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Total Cash</th>
              <th>Total Debt</th>
              <th>Net Position</th>
              <th>Income</th>
              <th>Spending</th>
              <th>Debt Paid</th>
              <th>Savings</th>
              <th>Cumulative Income</th>
              <th>Cumulative Debt Paid</th>
              <th>Cumulative Savings</th>
              {categoryNames.map((name) => (
                <th key={name}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.year}-${row.month}`}>
                <td>
                  {MONTH_NAMES[row.month - 1]} {row.year}
                </td>
                <td>{formatCurrency(row.totalCashSnapshot)}</td>
                <td>{formatCurrency(row.totalDebtSnapshot)}</td>
                <td>{formatCurrency(row.netPosition)}</td>
                <td>{formatCurrency(row.income)}</td>
                <td>{formatCurrency(row.spending)}</td>
                <td>{formatCurrency(row.debtPaid)}</td>
                <td>{formatCurrency(row.savings)}</td>
                <td>{formatCurrency(row.cumulativeIncome)}</td>
                <td>{formatCurrency(row.cumulativeDebtPaid)}</td>
                <td>{formatCurrency(row.cumulativeSavings)}</td>
                {categoryNames.map((name) => (
                  <td key={name}>
                    {row.categoryBalances[name] ? formatCurrency(row.categoryBalances[name]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
