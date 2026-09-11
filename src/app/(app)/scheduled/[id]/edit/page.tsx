import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { getScheduledTransaction } from "@/lib/scheduled/queries";
import { updateScheduledTransaction, toggleScheduledActive } from "@/lib/scheduled/actions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import {
  ScheduledTransactionFields,
  SCHEDULED_TYPE_LABELS,
  type ScheduledType,
} from "@/components/ScheduledTransactionFields";
import { buttonSecondary } from "@/lib/ui";

function normalizeType(raw: string | undefined, fallback: ScheduledType): ScheduledType {
  return raw && raw in SCHEDULED_TYPE_LABELS ? (raw as ScheduledType) : fallback;
}

export default async function EditScheduledPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; error?: string }>;
}) {
  const { id } = await params;
  const { type: typeParam, error } = await searchParams;
  const { userId } = await verifySession();
  const existing = await getScheduledTransaction(userId, id);

  if (!existing) {
    notFound();
  }

  const type = normalizeType(typeParam, existing.type as ScheduledType);

  return (
    <div className="max-w-md">
      <PageHeader
        title={`Edit ${existing.description}`}
        backHref="/scheduled"
        backLabel="Scheduled"
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(SCHEDULED_TYPE_LABELS) as ScheduledType[]).map((t) => (
          <Link
            key={t}
            href={`/scheduled/${id}/edit?type=${t}`}
            className={
              "rounded-full px-3 py-1 text-sm transition-colors " +
              (t === type
                ? "bg-accent/15 text-accent font-medium"
                : "bg-surface text-text-secondary hover:text-text border border-border")
            }
          >
            {SCHEDULED_TYPE_LABELS[t]}
          </Link>
        ))}
      </div>
      <Card>
        <ScheduledTransactionFields
          userId={userId}
          type={type}
          action={updateScheduledTransaction}
          error={error}
          existing={existing}
        />
      </Card>
      <form action={toggleScheduledActive} className="mt-4">
        <input type="hidden" name="scheduledId" value={existing.id} />
        <input type="hidden" name="isActive" value={String(existing.isActive)} />
        <SubmitButton className={buttonSecondary} pendingLabel="Saving…">
          {existing.isActive ? "Deactivate" : "Reactivate"}
        </SubmitButton>
      </form>
    </div>
  );
}
