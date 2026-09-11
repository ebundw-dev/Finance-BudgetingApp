import type { CategoryTargetStatus } from "@/lib/categories/targets";
import { ProgressBar } from "@/components/ProgressBar";
import { currency } from "@/lib/ui";

// Renders whatever's relevant for the category's target type -- a flat
// balance if there's no target at all, a progress bar for refill_up_to, a
// funded/underfunded pill for set_aside_monthly, or the computed
// monthly-need figure plus deadline for by_date. Shared between the
// Categories list and the Dashboard's Fund Progress so both stay in sync
// with src/lib/categories/targets.ts.
export function CategoryFundingCell({
  status,
  allocatedBalance,
  targetAmount,
  targetDate,
}: {
  status: CategoryTargetStatus | null;
  allocatedBalance: string;
  targetAmount: string | null;
  targetDate: string | null;
}) {
  if (!status) {
    return <span className="tabular-nums">{currency(allocatedBalance)}</span>;
  }

  if (status.targetType === "refill_up_to") {
    return (
      <div className="min-w-32">
        <div className="mb-1 flex justify-between text-xs">
          <span className={`tabular-nums ${status.underfunded ? "text-warning" : "text-text-secondary"}`}>
            {currency(allocatedBalance)}
          </span>
          <span className="text-text-secondary tabular-nums">of {currency(targetAmount!)}</span>
        </div>
        <ProgressBar percent={status.progressPercent} />
      </div>
    );
  }

  if (status.targetType === "set_aside_monthly") {
    return (
      <span
        className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
          status.underfunded ? "bg-danger/12 text-danger" : "bg-success/12 text-success"
        }`}
      >
        {status.underfunded ? "Not funded this month" : "Funded this month"}
      </span>
    );
  }

  // by_date
  return (
    <div>
      <div
        className={`text-sm font-medium tabular-nums ${status.underfunded ? "text-danger" : "text-text"}`}
      >
        {currency(status.monthlyNeeded)}/mo
      </div>
      {targetDate ? <div className="text-text-muted text-xs">by {targetDate}</div> : null}
    </div>
  );
}
