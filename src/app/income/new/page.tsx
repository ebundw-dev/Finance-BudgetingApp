import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listCashAccounts } from "@/lib/accounts/queries";
import { recordIncomeAction } from "@/lib/transactions/actions";

export default async function NewIncomePage({
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
      <h1>Record Income</h1>
      {accounts.length === 0 ? (
        <p>
          No cash accounts yet. <Link href="/accounts/new">Add one</Link> first.
        </p>
      ) : (
        <form action={recordIncomeAction}>
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
            <label htmlFor="amount">Amount</label>
            <input id="amount" name="amount" type="text" inputMode="decimal" required />
          </div>
          <div>
            <label htmlFor="date">Date</label>
            <input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <label htmlFor="source">Source</label>
            <input id="source" name="source" type="text" placeholder="e.g. Trading payout" />
          </div>
          <div>
            <label htmlFor="notes">Notes</label>
            <input id="notes" name="notes" type="text" />
          </div>
          <button type="submit">Record Income</button>
        </form>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
