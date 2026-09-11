import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listGoals } from "@/lib/goals/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { buttonPrimary, currency, link } from "@/lib/ui";

export default async function GoalsPage() {
  const { userId } = await verifySession();
  const goals = await listGoals(userId);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Goals" />
        <Link href="/goals/new" className={buttonPrimary}>
          Add goal
        </Link>
      </div>
      {goals.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">No goals yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {goals.map((goal) => {
            const percent =
              goal.allocatedBalance !== null
                ? Math.round((Number(goal.allocatedBalance) / Number(goal.targetAmount)) * 100)
                : null;
            return (
              <Card key={goal.id}>
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h2 className="font-medium text-text">{goal.name}</h2>
                    {goal.categoryName ? (
                      <p className="text-xs text-text-muted">{goal.categoryName}</p>
                    ) : (
                      <p className="text-xs text-text-muted">No linked category</p>
                    )}
                  </div>
                  <Link href={`/goals/${goal.id}/edit`} className={`${link} text-xs`}>
                    Edit
                  </Link>
                </div>
                {percent !== null ? (
                  <>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="tabular-nums text-text-secondary">
                        {currency(goal.allocatedBalance!)} of {currency(goal.targetAmount)}
                      </span>
                      <span className="tabular-nums text-text">{percent}%</span>
                    </div>
                    <ProgressBar percent={percent} />
                  </>
                ) : (
                  <p className="text-sm tabular-nums text-text-secondary">
                    Target {currency(goal.targetAmount)}
                  </p>
                )}
                {goal.targetDate ? (
                  <p className="mt-2 text-xs text-text-muted">By {goal.targetDate}</p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
