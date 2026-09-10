import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listRecentTransactions } from "@/lib/transactions/queries";

function formatCurrency(amount: string): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const TYPE_LABELS: Record<string, string> = {
  income: "Income",
  allocation: "Allocation",
  expense: "Expense",
  debt_payment: "Debt Payment",
  transfer: "Transfer",
  category_reallocation: "Reallocation",
};

export default async function TransactionsPage() {
  const { userId } = await verifySession();
  const rows = await listRecentTransactions(userId);

  return (
    <main>
      <p>
        <Link href="/">Dashboard</Link>
      </p>
      <h1>Transactions</h1>
      <p>
        <Link href="/income/new">Record income</Link> |{" "}
        <Link href="/transactions/new">New transaction</Link> |{" "}
        <Link href="/allocate">Allocate</Link>
      </p>
      {rows.length === 0 ? (
        <p>No transactions yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Account</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Source / Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.date}</td>
                <td>{TYPE_LABELS[row.type] ?? row.type}</td>
                <td>
                  {row.accountName ?? "—"}
                  {row.relatedAccountName ? ` → ${row.relatedAccountName}` : ""}
                </td>
                <td>
                  {row.categoryName ?? "—"}
                  {row.relatedCategoryName ? ` → ${row.relatedCategoryName}` : ""}
                </td>
                <td>{formatCurrency(row.amount)}</td>
                <td>{row.source ?? row.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
