import Link from "next/link";
import { Target } from "lucide-react";
import { verifySession } from "@/lib/auth/dal";
import { listGoals } from "@/lib/goals/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { buttonPrimary, buttonSecondary, currency } from "@/lib/ui";

export default async function GoalsPage() {
  const { userId } = await verifySession();
  const goals = await listGoals(userId);

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Keep the horizon close"
          title="Goals."
          subtitle="The life you're building is allowed to be visible before it's finished."
        />
        <Link href="/goals/new" className={`${buttonPrimary} mt-1`}>
          Add goal
        </Link>
      </div>
      {goals.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">No goals yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {goals.map((goal) => {
            const percent =
              goal.allocatedBalance !== null
                ? Math.round((Number(goal.allocatedBalance) / Number(goal.targetAmount)) * 100)
                : null;
            return (
              <Card key={goal.id}>
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                    <Target size={20} strokeWidth={2} />
                  </div>
                  {percent !== null ? (
                    <span className="rounded-full bg-accent/12 px-2.5 py-1 text-xs font-semibold tabular-nums text-accent">
                      {percent}%
                    </span>
                  ) : null}
                </div>
                <h2 className="mb-0.5 text-lg font-medium text-text">{goal.name}</h2>
                <p className="mb-4 text-xs text-text-muted">
                  {goal.categoryName ?? "No linked category"}
                </p>
                {percent !== null ? (
                  <>
                    <ProgressBar percent={percent} />
                    <div className="mt-2 flex items-baseline justify-between text-sm tabular-nums text-text-secondary">
                      <span>{currency(goal.allocatedBalance!)}</span>
                      <span>of {currency(goal.targetAmount)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm tabular-nums text-text-secondary">
                    Target {currency(goal.targetAmount)}
                  </p>
                )}
                {goal.targetDate ? (
                  <p className="mt-1 text-xs text-text-muted">By {goal.targetDate}</p>
                ) : null}
                <Link
                  href={`/goals/${goal.id}/edit`}
                  className={`${buttonSecondary} mt-5 w-full`}
                >
                  Edit target
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
