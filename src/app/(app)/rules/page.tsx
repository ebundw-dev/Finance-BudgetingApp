import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { getRuleSet, listRuleSetNames } from "@/lib/rules/queries";
import { deleteRuleSet } from "@/lib/rules/actions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonDanger, buttonPrimary } from "@/lib/ui";

// Cycled by row index so each rule set's segmented split bar and its list
// of rows share a consistent color -> category mapping at a glance.
const SEGMENT_COLORS = ["bg-accent", "bg-success", "bg-warning", "bg-danger", "bg-text-secondary"];

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ruleSets.map((ruleSet) => (
            <Card key={ruleSet.name}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-medium text-text">{ruleSet.name}</h2>
                <form action={deleteRuleSet}>
                  <input type="hidden" name="ruleName" value={ruleSet.name} />
                  <SubmitButton className={`${buttonDanger} px-2 py-1 text-xs`} pendingLabel="Deleting…">
                    Delete
                  </SubmitButton>
                </form>
              </div>
              <div className="mb-3 flex h-2 w-full overflow-hidden rounded-full bg-base">
                {ruleSet.rows.map((row, i) => (
                  <div
                    key={row.id}
                    className={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                    style={{ width: `${row.percentage}%` }}
                  />
                ))}
              </div>
              <ul className="space-y-1 text-sm text-text-secondary">
                {ruleSet.rows.map((row, i) => (
                  <li key={row.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]}`}
                      />
                      {row.categoryName}
                    </span>
                    <span className="tabular-nums text-text">{row.percentage}%</span>
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
