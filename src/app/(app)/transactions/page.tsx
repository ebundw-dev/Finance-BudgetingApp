import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listRecentTransactions } from "@/lib/transactions/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { buttonPrimary, buttonSecondary, currency, link, successBanner, table, td, th } from "@/lib/ui";

const TYPE_LABELS: Record<string, string> = {
  income: "Income",
  allocation: "Allocation",
  expense: "Expense",
  debt_payment: "Debt Payment",
  transfer: "Transfer",
  category_reallocation: "Reallocation",
};

const TYPE_BADGE: Record<string, string> = {
  income: "bg-success/12 text-success",
  allocation: "bg-accent/12 text-accent",
  expense: "bg-danger/12 text-danger",
  debt_payment: "bg-warning/12 text-warning",
  transfer: "bg-text-secondary/10 text-text-secondary",
  category_reallocation: "bg-text-secondary/10 text-text-secondary",
};

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const { userId } = await verifySession();
  const [rows, { success }] = await Promise.all([listRecentTransactions(userId), searchParams]);

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Every dollar, accounted for"
          title="Transactions."
          subtitle="The full record — nothing hidden, nothing rounded away."
        />
        <div className="mt-1 flex flex-wrap gap-2">
          <Link href="/income/new" className={buttonSecondary}>
            Record income
          </Link>
          <Link href="/transactions/new" className={buttonSecondary}>
            New transaction
          </Link>
          <Link href="/allocate" className={buttonPrimary}>
            Allocate
          </Link>
        </div>
      </div>
      {success ? (
        <p role="status" className={successBanner}>
          {success}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">No transactions yet.</p>
        </Card>
      ) : (
        <Card padded={false} className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Type</th>
                <th className={th}>Account</th>
                <th className={th}>Category</th>
                <th className={th}>Amount</th>
                <th className={th}>Source / Notes</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className={`${td} whitespace-nowrap`}>{row.date}</td>
                  <td className={td}>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TYPE_BADGE[row.type] ?? "bg-surface-hover text-text-secondary"}`}
                    >
                      {TYPE_LABELS[row.type] ?? row.type}
                    </span>
                  </td>
                  <td className={td}>
                    {row.accountName ?? "—"}
                    {row.relatedAccountName ? ` → ${row.relatedAccountName}` : ""}
                  </td>
                  <td className={td}>
                    {row.splits.length > 0 ? (
                      <details>
                        <summary className="cursor-pointer list-none">
                          <span className="rounded-full bg-accent/12 px-2 py-0.5 text-xs font-medium text-accent">
                            Split ({row.splits.length})
                          </span>
                        </summary>
                        <ul className="mt-2 space-y-1 text-xs text-text-secondary">
                          {row.splits.map((s) => (
                            <li key={s.categoryId} className="flex justify-between gap-4">
                              <span>{s.categoryName}</span>
                              <span className="tabular-nums">{currency(s.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <>
                        {row.categoryName ?? "—"}
                        {row.relatedCategoryName ? ` → ${row.relatedCategoryName}` : ""}
                      </>
                    )}
                  </td>
                  <td className={`${td} tabular-nums`}>{currency(row.amount)}</td>
                  <td className={`${td} text-text-secondary`}>{row.source ?? row.notes ?? ""}</td>
                  <td className={td}>
                    {row.splits.length > 0 ? (
                      <Link href={`/transactions/${row.id}/edit`} className={link}>
                        Edit
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
