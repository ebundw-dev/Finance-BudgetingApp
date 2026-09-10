import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listRuleSetNames } from "@/lib/rules/queries";
import { getUnallocatedCash } from "@/lib/allocation/queries";
import { applyRuleSetAction } from "@/lib/allocation/actions";

function formatCurrency(amount: string): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function AutoAllocatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { userId } = await verifySession();
  const [ruleNames, unallocated] = await Promise.all([
    listRuleSetNames(userId),
    getUnallocatedCash(userId),
  ]);

  return (
    <main>
      <p>
        <Link href="/allocate">Allocate</Link>
      </p>
      <h1>Auto-Allocate</h1>
      <p>
        Unallocated Cash: <strong>{formatCurrency(unallocated)}</strong>
      </p>
      {ruleNames.length === 0 ? (
        <p>
          No rule sets yet. <Link href="/rules/new">Create one</Link> first.
        </p>
      ) : (
        <form action={applyRuleSetAction}>
          <div>
            <label htmlFor="ruleName">Rule set</label>
            <select id="ruleName" name="ruleName" required>
              {ruleNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="amount">Amount to split</label>
            <input
              id="amount"
              name="amount"
              type="text"
              inputMode="decimal"
              defaultValue={unallocated}
              required
            />
          </div>
          <button type="submit">Apply</button>
        </form>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
