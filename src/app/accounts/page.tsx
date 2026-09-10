import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listAccounts } from "@/lib/accounts/queries";

function formatCurrency(amount: string): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function AccountsPage() {
  const { userId } = await verifySession();
  const accounts = await listAccounts(userId);

  return (
    <main>
      <p>
        <Link href="/">Dashboard</Link>
      </p>
      <h1>Accounts</h1>
      <p>
        <Link href="/accounts/new">Add account</Link>
      </p>
      {accounts.length === 0 ? (
        <p>No accounts yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Cash?</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
                <td>{account.type}</td>
                <td>{account.isCashAccount ? "Yes" : "No"}</td>
                <td>{formatCurrency(account.currentBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
