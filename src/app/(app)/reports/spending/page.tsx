import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { getCategorySpendingForMonth } from "@/lib/reports/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { CategorySpendingChart } from "@/components/CategorySpendingChart";
import { CategorySpendingTable } from "@/components/CategorySpendingTable";
import { buttonSecondary, currency } from "@/lib/ui";

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

export default async function SpendingReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { userId } = await verifySession();
  const params = await searchParams;

  const now = new Date();
  const year = params.year ? Number(params.year) : now.getUTCFullYear();
  const month = params.month ? Number(params.month) : now.getUTCMonth() + 1;

  const rows = await getCategorySpendingForMonth(userId, year, month);
  const totalSpending = rows.reduce((sum, row) => sum + Number(row.total), 0);

  const groupTotals = Array.from(
    rows
      .reduce((map, row) => {
        map.set(row.groupName, (map.get(row.groupName) ?? 0) + Number(row.total));
        return map;
      }, new Map<string, number>())
      .entries()
  )
    .map(([groupName, total]) => ({ groupName, total }))
    .sort((a, b) => b.total - a.total);

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Where did it go"
          title={`Spending in ${MONTH_NAMES[month - 1]} ${year}.`}
          subtitle="Every expense this month, broken down by category."
        />
        <div className="mt-1 flex gap-2">
          <Link
            href={`/reports/spending?year=${prev.year}&month=${prev.month}`}
            className={buttonSecondary}
          >
            &larr; Previous
          </Link>
          <Link
            href={`/reports/spending?year=${next.year}&month=${next.month}`}
            className={buttonSecondary}
          >
            Next &rarr;
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            No spending recorded for {MONTH_NAMES[month - 1]} {year}.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CategorySpendingChart rows={rows} />
            </div>
            <Card>
              <h2 className="mb-4 text-sm font-medium tracking-wide text-text-secondary uppercase">
                By Group
              </h2>
              <ul className="space-y-2 text-sm">
                {groupTotals.map((group) => (
                  <li key={group.groupName} className="flex justify-between">
                    <span className="text-text-secondary">{group.groupName}</span>
                    <span className="tabular-nums text-text">{currency(group.total.toFixed(2))}</span>
                  </li>
                ))}
              </ul>
              <div className="border-border mt-3 flex justify-between border-t pt-3 text-sm font-medium">
                <span className="text-text">Total</span>
                <span className="tabular-nums text-text">{currency(totalSpending.toFixed(2))}</span>
              </div>
            </Card>
          </div>

          <Card padded={false} className="overflow-x-auto">
            <CategorySpendingTable rows={rows} totalSpending={totalSpending} />
          </Card>
        </>
      )}
    </div>
  );
}
