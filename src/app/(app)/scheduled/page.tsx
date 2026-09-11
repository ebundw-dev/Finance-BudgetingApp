import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import {
  listDueScheduledTransactions,
  listScheduledTransactions,
  listUpcomingScheduledTransactions,
} from "@/lib/scheduled/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { ConfirmScheduledForm } from "@/components/ConfirmScheduledForm";
import {
  buttonPrimary,
  currency,
  errorBanner,
  link,
  successBanner,
  table,
  td,
  th,
} from "@/lib/ui";

const TYPE_LABELS: Record<string, string> = {
  income: "Income",
  allocation: "Allocation",
  expense: "Expense",
  debt_payment: "Debt Payment",
  transfer: "Transfer",
  category_reallocation: "Reallocation",
};

const TYPE_BADGE: Record<string, string> = {
  income: "bg-success/12 text-success",
  allocation: "bg-accent/12 text-accent",
  expense: "bg-danger/12 text-danger",
  debt_payment: "bg-warning/12 text-warning",
  transfer: "bg-text-secondary/10 text-text-secondary",
  category_reallocation: "bg-text-secondary/10 text-text-secondary",
};

const CADENCE_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  yearly: "Yearly",
  custom_days: "Custom",
};

export default async function ScheduledPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { userId } = await verifySession();
  const [due, upcoming, all, { success, error }] = await Promise.all([
    listDueScheduledTransactions(userId),
    listUpcomingScheduledTransactions(userId),
    listScheduledTransactions(userId),
    searchParams,
  ]);

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Embrace your true expenses"
          title="Scheduled."
          subtitle="Bills and irregular expenses get budgeted for before they hit — not the day they surprise you."
        />
        <Link href="/scheduled/new" className={`${buttonPrimary} mt-1`}>
          Add scheduled transaction
        </Link>
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

      {due.length > 0 ? (
        <div className="mb-8">
          <h2 className="mb-4 text-sm font-medium tracking-wide text-danger uppercase">
            Due ({due.length})
          </h2>
          <div className="space-y-3">
            {due.map((item) => (
              <Card key={item.id} className="ring-1 ring-danger/30">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text">{item.description}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TYPE_BADGE[item.type] ?? "bg-surface-hover text-text-secondary"}`}
                      >
                        {TYPE_LABELS[item.type] ?? item.type}
                      </span>
                    </div>
                    <p className="text-text-secondary mt-1 text-xs">
                      Due {item.nextDueDate} — {CADENCE_LABELS[item.cadence] ?? item.cadence}
                    </p>
                  </div>
                  <ConfirmScheduledForm id={item.id} defaultAmount={item.amount} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="mb-10">
          <h2 className="mb-4 text-sm font-medium tracking-wide text-text-secondary uppercase">
            Coming up in the next 7 days
          </h2>
          <div className="space-y-3">
            {upcoming.map((item) => (
              <Card key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text">{item.description}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TYPE_BADGE[item.type] ?? "bg-surface-hover text-text-secondary"}`}
                      >
                        {TYPE_LABELS[item.type] ?? item.type}
                      </span>
                    </div>
                    <p className="text-text-secondary mt-1 text-xs">Due {item.nextDueDate}</p>
                  </div>
                  <span className="tabular-nums text-text">{currency(item.amount)}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <h2 className="mb-4 text-sm font-medium tracking-wide text-text-secondary uppercase">
        All scheduled
      </h2>
      {all.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            No scheduled transactions yet. Add one for a recurring bill, paycheck, or transfer.
          </p>
        </Card>
      ) : (
        <Card padded={false} className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Description</th>
                <th className={th}>Type</th>
                <th className={th}>Amount</th>
                <th className={th}>Repeats</th>
                <th className={th}>Next due</th>
                <th className={th}>Status</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {all.map((item) => (
                <tr
                  key={item.id}
                  className={`hover:bg-surface-hover/60 transition-colors ${item.isActive ? "" : "opacity-50"}`}
                >
                  <td className={td}>{item.description}</td>
                  <td className={td}>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TYPE_BADGE[item.type] ?? "bg-surface-hover text-text-secondary"}`}
                    >
                      {TYPE_LABELS[item.type] ?? item.type}
                    </span>
                  </td>
                  <td className={`${td} tabular-nums`}>{currency(item.amount)}</td>
                  <td className={td}>{CADENCE_LABELS[item.cadence] ?? item.cadence}</td>
                  <td className={`${td} whitespace-nowrap`}>{item.nextDueDate}</td>
                  <td className={td}>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.isActive
                          ? "bg-success/12 text-success"
                          : "bg-text-secondary/10 text-text-secondary"
                      }`}
                    >
                      {item.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className={td}>
                    <Link href={`/scheduled/${item.id}/edit`} className={link}>
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
