import Link from "next/link";
import { SplitSquareHorizontal } from "lucide-react";
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
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Split it automatically"
          title="Rule Sets."
          subtitle="Percentages you trust enough to stop thinking about."
        />
        <Link href="/rules/new" className={`${buttonPrimary} mt-1`}>
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {ruleSets.map((ruleSet) => (
            <Card key={ruleSet.name}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                    <SplitSquareHorizontal size={18} strokeWidth={2} />
                  </div>
                  <h2 className="font-medium text-text">{ruleSet.name}</h2>
                </div>
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
