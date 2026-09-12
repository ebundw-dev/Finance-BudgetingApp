import { verifySession } from "@/lib/auth/dal";
import { getSubscriptionCandidates } from "@/lib/subscriptions/queries";
import { dismissSubscriptionCandidate } from "@/lib/subscriptions/actions";
import { createScheduledTransaction } from "@/lib/scheduled/actions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonPrimary, buttonSecondary, currency, errorBanner, successBanner } from "@/lib/ui";

const CADENCE_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { userId } = await verifySession();
  const [candidates, { success, error }] = await Promise.all([
    getSubscriptionCandidates(userId),
    searchParams,
  ]);

  return (
    <div>
      <div className="mb-10">
        <PageHeader
          eyebrow="Detected from your history"
          title="Subscriptions."
          subtitle="Recurring charges found in your transaction history, no bank sync required. Track the ones you want budgeted for going forward, or dismiss the rest."
        />
      </div>

      {success ? (
        <p role="status" className={successBanner}>
          {success}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={errorBanner}>
          {error}
        </p>
      ) : null}

      {candidates.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            No new recurring charges detected. Candidates need at least 2 charges to the same
            account at a consistent amount and interval — check back after a bit more history, or
            look in Scheduled for anything already tracked.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((candidate) => (
            <Card key={`${candidate.accountId}-${candidate.categoryId}-${candidate.payeeKey}`}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium text-text">{candidate.payee}</div>
                  <p className="text-text-secondary truncate text-xs">
                    {candidate.accountName} &middot; {candidate.categoryName}
                  </p>
                </div>
                <span className="bg-accent/12 text-accent rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                  {CADENCE_LABELS[candidate.cadence] ?? candidate.cadence}
                </span>
              </div>

              <div className="mb-1 text-2xl font-semibold tabular-nums text-text">
                {currency(candidate.averageAmount)}
              </div>
              <p className="text-text-secondary mb-4 text-xs">
                {candidate.occurrenceCount} charges detected &middot; next predicted{" "}
                {candidate.nextPredictedDate}
              </p>

              <div className="flex flex-wrap gap-2">
                <form action={createScheduledTransaction}>
                  <input type="hidden" name="type" value="expense" />
                  <input type="hidden" name="description" value={candidate.payee} />
                  <input type="hidden" name="amount" value={candidate.averageAmount} />
                  <input type="hidden" name="cadence" value={candidate.cadence} />
                  <input type="hidden" name="nextDueDate" value={candidate.nextPredictedDate} />
                  <input type="hidden" name="accountId" value={candidate.accountId} />
                  <input type="hidden" name="categoryId" value={candidate.categoryId} />
                  <SubmitButton className={`${buttonPrimary} px-3 py-1.5 text-xs`} pendingLabel="Tracking…">
                    Track it
                  </SubmitButton>
                </form>
                <form action={dismissSubscriptionCandidate}>
                  <input type="hidden" name="accountId" value={candidate.accountId} />
                  <input type="hidden" name="categoryId" value={candidate.categoryId} />
                  <input type="hidden" name="payeeKey" value={candidate.payeeKey} />
                  <SubmitButton className={`${buttonSecondary} px-3 py-1.5 text-xs`} pendingLabel="Dismissing…">
                    Dismiss
                  </SubmitButton>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
