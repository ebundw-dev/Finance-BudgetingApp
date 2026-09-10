import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { getRuleSet, listRuleSetNames } from "@/lib/rules/queries";
import { deleteRuleSet } from "@/lib/rules/actions";

export default async function RulesPage() {
  const { userId } = await verifySession();
  const names = await listRuleSetNames(userId);
  const ruleSets = await Promise.all(
    names.map(async (name) => ({ name, rows: await getRuleSet(userId, name) }))
  );

  return (
    <main>
      <p>
        <Link href="/">Dashboard</Link>
      </p>
      <h1>Allocation Rule Sets</h1>
      <p>
        <Link href="/rules/new">Add rule set</Link>
      </p>
      {ruleSets.length === 0 ? (
        <p>No rule sets yet. Auto-Allocate needs at least one.</p>
      ) : (
        ruleSets.map((ruleSet) => (
          <section key={ruleSet.name}>
            <h2>{ruleSet.name}</h2>
            <ul>
              {ruleSet.rows.map((row) => (
                <li key={row.id}>
                  {row.categoryName}: {row.percentage}%
                </li>
              ))}
            </ul>
            <form action={deleteRuleSet}>
              <input type="hidden" name="ruleName" value={ruleSet.name} />
              <button type="submit">Delete</button>
            </form>
          </section>
        ))
      )}
    </main>
  );
}
