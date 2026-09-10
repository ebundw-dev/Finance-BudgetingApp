import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listCategories } from "@/lib/categories/queries";
import { createRuleSet } from "@/lib/rules/actions";

const ROW_COUNT = 8;

export default async function NewRuleSetPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { userId } = await verifySession();
  const categories = await listCategories(userId);

  return (
    <main>
      <p>
        <Link href="/rules">Rule Sets</Link>
      </p>
      <h1>New Rule Set</h1>
      {categories.length === 0 ? (
        <p>
          No categories yet. <Link href="/categories/new">Add one</Link> first.
        </p>
      ) : (
        <form action={createRuleSet}>
          <div>
            <label htmlFor="ruleName">Name</label>
            <input id="ruleName" name="ruleName" type="text" required autoFocus />
          </div>
          <p>Leave a row blank to skip it. Percentages across all filled-in rows must sum to 100.</p>
          {Array.from({ length: ROW_COUNT }).map((_, i) => (
            <div key={i}>
              <select name="categoryId[]" defaultValue="">
                <option value="">— none —</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <input
                name="percentage[]"
                type="text"
                inputMode="decimal"
                placeholder="%"
                size={6}
              />
            </div>
          ))}
          <button type="submit">Create Rule Set</button>
        </form>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
