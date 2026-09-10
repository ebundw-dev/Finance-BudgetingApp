import Link from "next/link";
import { accountTypeEnum } from "@/db/schema";
import { createAccount } from "@/lib/accounts/actions";

export default async function NewAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main>
      <p>
        <Link href="/accounts">Accounts</Link>
      </p>
      <h1>Add Account</h1>
      <form action={createAccount}>
        <div>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required autoFocus />
        </div>
        <div>
          <label htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue="checking">
            {accountTypeEnum.enumValues.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="currentBalance">Starting balance</label>
          <input
            id="currentBalance"
            name="currentBalance"
            type="text"
            inputMode="decimal"
            defaultValue="0.00"
          />
        </div>
        <div>
          <label>
            <input type="checkbox" name="isCashAccount" defaultChecked />
            This is a cash account (checking/savings/cash)
          </label>
        </div>
        <div>
          <label>
            <input type="checkbox" name="isDebt" />
            Track this as a debt (creates a linked reserve category)
          </label>
        </div>
        <button type="submit">Create Account</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
