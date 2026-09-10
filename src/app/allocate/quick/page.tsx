import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listCashAccounts } from "@/lib/accounts/queries";
import { quickPayoutAction } from "@/lib/allocation/actions";

export default async function QuickPayoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { userId } = await verifySession();
  const accounts = await listCashAccounts(userId);

  return (
    <main>
      <p>
        <Link href="/">Dashboard</Link>
      </p>
      <h1>Quick Payout Allocation</h1>
      <p>
        Record the deposit, then go straight to allocating it against your priority categories.
      </p>
      {accounts.length === 0 ? (
        <p>
          No cash accounts yet. <Link href="/accounts/new">Add one</Link> first.
        </p>
      ) : (
        <form action={quickPayoutAction}>
          <div>
            <label htmlFor="accountId">Deposit into</label>
            <select id="accountId" name="accountId" required>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="amount">Payout amount</label>
            <input id="amount" name="amount" type="text" inputMode="decimal" required autoFocus />
          </div>
          <div>
            <label htmlFor="source">Source</label>
            <input id="source" name="source" type="text" placeholder="e.g. Trading payout" />
          </div>
          <button type="submit">Continue to Allocation</button>
        </form>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
