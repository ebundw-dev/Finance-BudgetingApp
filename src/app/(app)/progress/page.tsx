import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { getProgressData } from "@/lib/months/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { ProgressCharts } from "@/components/ProgressCharts";
import { currency, link, table, td, th } from "@/lib/ui";

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
    <div>
      <PageHeader
        eyebrow="Historical progress"
        title="The record speaks for itself."
        subtitle="Not a scoreboard — just the choices that have been adding up."
      />
      <p className="mb-10 text-sm text-text-secondary">
        Built from snapshots taken via the monthly view&apos;s &quot;Take snapshot&quot; button --
        no data appears here until at least one month has been snapshotted.
      </p>
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            No snapshots yet. Go to{" "}
            <Link href="/monthly" className={link}>
              Monthly View
            </Link>{" "}
            and take one for the current month.
          </p>
        </Card>
      ) : rows.length === 1 ? (
        <Card>
          <p className="text-sm text-text-muted">
            One month snapshotted so far -- charts need at least two points to plot a trend. The
            table below already has it.
          </p>
        </Card>
      ) : (
        <ProgressCharts rows={rows} goalCategoryNames={categoryNames} />
      )}
      {rows.length > 0 ? (
        <Card padded={false} className="mt-2 overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Month</th>
                <th className={th}>Total Cash</th>
                <th className={th}>Total Debt</th>
                <th className={th}>Net Position</th>
                <th className={th}>Income</th>
                <th className={th}>Spending</th>
                <th className={th}>Debt Paid</th>
                <th className={th}>Savings</th>
                <th className={th}>Cum. Income</th>
                <th className={th}>Cum. Debt Paid</th>
                <th className={th}>Cum. Savings</th>
                {categoryNames.map((name) => (
                  <th key={name} className={th}>
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.year}-${row.month}`}>
                  <td className={`${td} whitespace-nowrap`}>
                    {MONTH_NAMES[row.month - 1]} {row.year}
                  </td>
                  <td className={`${td} tabular-nums`}>{currency(row.totalCashSnapshot)}</td>
                  <td className={`${td} tabular-nums`}>{currency(row.totalDebtSnapshot)}</td>
                  <td className={`${td} tabular-nums`}>{currency(row.netPosition)}</td>
                  <td className={`${td} tabular-nums`}>{currency(row.income)}</td>
                  <td className={`${td} tabular-nums`}>{currency(row.spending)}</td>
                  <td className={`${td} tabular-nums`}>{currency(row.debtPaid)}</td>
                  <td className={`${td} tabular-nums`}>{currency(row.savings)}</td>
                  <td className={`${td} tabular-nums`}>{currency(row.cumulativeIncome)}</td>
                  <td className={`${td} tabular-nums`}>{currency(row.cumulativeDebtPaid)}</td>
                  <td className={`${td} tabular-nums`}>{currency(row.cumulativeSavings)}</td>
                  {categoryNames.map((name) => (
                    <td key={name} className={`${td} tabular-nums`}>
                      {row.categoryBalances[name] ? currency(row.categoryBalances[name]) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
