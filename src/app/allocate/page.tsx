import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listCategories, listPriorityCategories } from "@/lib/categories/queries";
import { getUnallocatedCash } from "@/lib/allocation/queries";
import { allocateAction } from "@/lib/allocation/actions";

function formatCurrency(amount: string): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function AllocatePage({
  searchParams,
}: {
  searchParams: Promise<{ priority?: string; error?: string }>;
}) {
  const { priority, error } = await searchParams;
  const showPriorityOnly = priority === "1";
  const { userId } = await verifySession();

  const [unallocated, categories] = await Promise.all([
    getUnallocatedCash(userId),
    showPriorityOnly ? listPriorityCategories(userId) : listCategories(userId),
  ]);

  return (
    <main>
      <p>
        <Link href="/">Dashboard</Link>
      </p>
      <h1>Allocate</h1>
      <p>
        Unallocated Cash: <strong>{formatCurrency(unallocated)}</strong>
      </p>
      <p>
        {showPriorityOnly ? (
          <Link href="/allocate">Show all categories</Link>
        ) : (
          <Link href="/allocate?priority=1">Show priority categories only</Link>
        )}
        {" | "}
        <Link href="/allocate/auto">Auto-Allocate</Link>
        {" | "}
        <Link href="/allocate/quick">Quick Payout Allocation</Link>
      </p>

      {categories.length === 0 ? (
        <p>
          {showPriorityOnly
            ? "No categories are tagged with a priority yet. Set one from the category edit screen."
            : "No categories yet."}
        </p>
      ) : (
        <form action={allocateAction}>
          {showPriorityOnly ? <input type="hidden" name="priority" value="1" /> : null}
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Current Balance</th>
                <th>Amount to Allocate</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    {category.name}
                    {category.priority ? ` (${category.priority})` : ""}
                  </td>
                  <td>{formatCurrency(category.allocatedBalance)}</td>
                  <td>
                    <input type="hidden" name="categoryId[]" value={category.id} />
                    <input name="amount[]" type="text" inputMode="decimal" defaultValue="0" size={10} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="submit">Allocate</button>
        </form>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
