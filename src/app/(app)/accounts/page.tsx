import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listAccounts } from "@/lib/accounts/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { buttonPrimary, currency, table, td, th } from "@/lib/ui";

export default async function AccountsPage() {
  const { userId } = await verifySession();
  const accounts = await listAccounts(userId);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Accounts" />
        <Link href="/accounts/new" className={buttonPrimary}>
          Add account
        </Link>
      </div>
      {accounts.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">No accounts yet.</p>
        </Card>
      ) : (
        <Card padded={false} className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Type</th>
                <th className={th}>Cash?</th>
                <th className={th}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td className={td}>{account.name}</td>
                  <td className={td}>{account.type}</td>
                  <td className={td}>{account.isCashAccount ? "Yes" : "No"}</td>
                  <td className={`${td} tabular-nums`}>{currency(account.currentBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
