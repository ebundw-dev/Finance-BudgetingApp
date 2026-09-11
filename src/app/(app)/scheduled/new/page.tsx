import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { createScheduledTransaction } from "@/lib/scheduled/actions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import {
  ScheduledTransactionFields,
  SCHEDULED_TYPE_LABELS,
  type ScheduledType,
} from "@/components/ScheduledTransactionFields";

function normalizeType(raw: string | undefined): ScheduledType {
  return raw && raw in SCHEDULED_TYPE_LABELS ? (raw as ScheduledType) : "expense";
}

export default async function NewScheduledPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; error?: string }>;
}) {
  const { type: typeParam, error } = await searchParams;
  const type = normalizeType(typeParam);
  const { userId } = await verifySession();

  return (
    <div className="max-w-md">
      <PageHeader title="New Scheduled Transaction" backHref="/scheduled" backLabel="Scheduled" />
      <div className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(SCHEDULED_TYPE_LABELS) as ScheduledType[]).map((t) => (
          <Link
            key={t}
            href={`/scheduled/new?type=${t}`}
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
          action={createScheduledTransaction}
          error={error}
        />
      </Card>
    </div>
  );
}
