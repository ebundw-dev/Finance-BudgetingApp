import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listRecentTransactions } from "@/lib/transactions/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { buttonPrimary, buttonSecondary, currency, table, td, th } from "@/lib/ui";

const TYPE_LABELS: Record<string, string> = {
  income: "Income",
  allocation: "Allocation",
  expense: "Expense",
  debt_payment: "Debt Payment",
  transfer: "Transfer",
  category_reallocation: "Reallocation",
};

const TYPE_BADGE: Record<string, string> = {
  income: "bg-success/15 text-success",
  allocation: "bg-accent/15 text-accent",
  expense: "bg-danger/15 text-danger",
  debt_payment: "bg-warning/15 text-warning",
  transfer: "bg-surface-hover text-text-secondary",
  category_reallocation: "bg-surface-hover text-text-secondary",
};

export default async function TransactionsPage() {
  const { userId } = await verifySession();
  const rows = await listRecentTransactions(userId);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Transactions" />
        <div className="flex flex-wrap gap-2">
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
                    {row.categoryName ?? "—"}
                    {row.relatedCategoryName ? ` → ${row.relatedCategoryName}` : ""}
                  </td>
                  <td className={`${td} tabular-nums`}>{currency(row.amount)}</td>
                  <td className={`${td} text-text-secondary`}>{row.source ?? row.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
