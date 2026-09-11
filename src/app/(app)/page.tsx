import Link from "next/link";
import {
  Wallet,
  Coins,
  CreditCard,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Target,
  Bell,
} from "lucide-react";
import { verifySession } from "@/lib/auth/dal";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getCategoryFundingStatus } from "@/lib/categories/targets";
import { Card, StatCard } from "@/components/Card";
import { CategoryFundingCell } from "@/components/CategoryFundingCell";
import { PhaseForm } from "@/components/PhaseForm";
import { PageHeader } from "@/components/PageHeader";
import { currency } from "@/lib/ui";

export default async function Home() {
  const { userId } = await verifySession();
  const data = await getDashboardData(userId);
  const netPositive = Number(data.netFinancialPosition) >= 0;

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Overview"
          title="Where you stand, today."
          subtitle="Not a scorecard — just an honest look at where your money already is."
        />
        <PhaseForm initialPhase={data.phase} />
      </div>

      {data.dueScheduledCount > 0 || data.upcomingScheduledCount > 0 ? (
        <Link href="/scheduled" className="mb-6 block">
          <Card
            className={`transition-colors hover:bg-surface-hover ${
              data.dueScheduledCount > 0 ? "ring-1 ring-danger/30" : "ring-1 ring-warning/30"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  data.dueScheduledCount > 0 ? "bg-danger/12 text-danger" : "bg-warning/12 text-warning"
                }`}
              >
                <Bell size={18} strokeWidth={2} />
              </div>
              <div>
                <div className="font-medium text-text">
                  {data.dueScheduledCount > 0
                    ? `${data.dueScheduledCount} scheduled transaction${data.dueScheduledCount === 1 ? "" : "s"} due`
                    : `${data.upcomingScheduledCount} scheduled transaction${data.upcomingScheduledCount === 1 ? "" : "s"} coming up`}
                </div>
                <p className="text-text-secondary text-xs">
                  {data.dueScheduledCount > 0 && data.upcomingScheduledCount > 0
                    ? `Plus ${data.upcomingScheduledCount} more within 7 days. Tap to review.`
                    : "Tap to review, confirm, or skip."}
                </p>
              </div>
            </div>
          </Card>
        </Link>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Cash" value={currency(data.totalCash)} tone="accent" icon={Wallet} />
        <StatCard
          label="Unallocated Cash"
          value={currency(data.unallocatedCash)}
          tone="info"
          icon={Coins}
        />
        <StatCard
          label="Total Debt"
          value={currency(data.totalDebt)}
          tone="danger"
          icon={CreditCard}
        />
        <StatCard
          label="Net Financial Position"
          value={currency(data.netFinancialPosition)}
          tone={netPositive ? "success" : "danger"}
          icon={TrendingUp}
        />
      </div>

      <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard
          label="Income This Month"
          value={currency(data.incomeThisMonth)}
          tone="success"
          icon={ArrowDownCircle}
        />
        <StatCard
          label="Spending This Month"
          value={currency(data.spendingThisMonth)}
          tone="warning"
          icon={ArrowUpCircle}
        />
        <StatCard
          label="Debt Paid This Month"
          value={currency(data.debtPaidThisMonth)}
          tone="accent"
          icon={CheckCircle2}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-5 text-sm font-medium tracking-wide text-text-secondary uppercase">
            Fund Progress
          </h2>
          {data.goalProgress.length === 0 ? (
            <p className="text-sm text-text-muted">
              No goal categories with a target yet. Set one from{" "}
              <Link href="/categories" className="text-accent hover:underline">
                Categories
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-6">
              {data.goalProgress.map((goal) => {
                const status = getCategoryFundingStatus({
                  targetType: goal.targetType,
                  targetAmount: goal.targetAmount,
                  targetDate: goal.targetDate,
                  allocatedBalance: goal.allocatedBalance,
                  allocatedThisMonth: goal.allocatedThisMonth,
                });
                return (
                  <li key={goal.id} className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        status?.underfunded ? "bg-danger/12 text-danger" : "bg-accent/12 text-accent"
                      }`}
                    >
                      <Target size={16} strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 text-sm font-medium text-text">{goal.name}</div>
                      <CategoryFundingCell
                        status={status}
                        allocatedBalance={goal.allocatedBalance}
                        targetAmount={goal.targetAmount}
                        targetDate={goal.targetDate}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-5 text-sm font-medium tracking-wide text-text-secondary uppercase">
            Earmarked
          </h2>
          {data.earmarked.length === 0 ? (
            <p className="text-sm text-text-muted">Nothing earmarked yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.earmarked.map((category) => (
                <li key={category.name} className="flex justify-between text-sm">
                  <span className="text-text">{category.name}</span>
                  <span className="tabular-nums text-text-secondary">
                    {currency(category.allocatedBalance)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
