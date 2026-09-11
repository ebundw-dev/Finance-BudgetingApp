import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { getRuleSet, listRuleSetNames } from "@/lib/rules/queries";
import { deleteRuleSet } from "@/lib/rules/actions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { buttonDanger, buttonPrimary } from "@/lib/ui";

export default async function RulesPage() {
  const { userId } = await verifySession();
  const names = await listRuleSetNames(userId);
  const ruleSets = await Promise.all(
    names.map(async (name) => ({ name, rows: await getRuleSet(userId, name) }))
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Allocation Rule Sets" />
        <Link href="/rules/new" className={buttonPrimary}>
          Add rule set
        </Link>
      </div>
      {ruleSets.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            No rule sets yet. Auto-Allocate needs at least one.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {ruleSets.map((ruleSet) => (
            <Card key={ruleSet.name}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-medium text-text">{ruleSet.name}</h2>
                <form action={deleteRuleSet}>
                  <input type="hidden" name="ruleName" value={ruleSet.name} />
                  <button type="submit" className={buttonDanger}>
                    Delete
                  </button>
                </form>
              </div>
              <ul className="space-y-1 text-sm text-text-secondary">
                {ruleSet.rows.map((row) => (
                  <li key={row.id} className="flex justify-between">
                    <span>{row.categoryName}</span>
                    <span className="tabular-nums">{row.percentage}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
