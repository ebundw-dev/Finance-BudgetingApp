import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { accounts, categories } from "@/db/schema";
import { verifySession } from "@/lib/auth/dal";
import { getTransactionHistory, type TransactionHistoryRow } from "@/lib/transactions/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { currency } from "@/lib/ui";

interface Snapshot {
  type?: string;
  amount?: string;
  date?: string;
  source?: string | null;
  notes?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  splits?: { categoryId: string; amount: string }[];
}

function collectIds(rows: TransactionHistoryRow[]): { categoryIds: Set<string>; accountIds: Set<string> } {
  const categoryIds = new Set<string>();
  const accountIds = new Set<string>();
  for (const row of rows) {
    for (const snap of [row.oldValues as Snapshot | null, row.newValues as Snapshot | null]) {
      if (!snap) continue;
      if (snap.categoryId) categoryIds.add(snap.categoryId);
      if (snap.accountId) accountIds.add(snap.accountId);
      for (const split of snap.splits ?? []) categoryIds.add(split.categoryId);
    }
  }
  return { categoryIds, accountIds };
}

export default async function TransactionHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await verifySession();
  const history = await getTransactionHistory(userId, id);

  const { categoryIds, accountIds } = collectIds(history);
  const [categoryRows, accountRows] = await Promise.all([
    categoryIds.size > 0
      ? db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, [...categoryIds]))
      : Promise.resolve([]),
    accountIds.size > 0
      ? db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(inArray(accounts.id, [...accountIds]))
      : Promise.resolve([]),
  ]);
  const categoryNames = new Map(categoryRows.map((c) => [c.id, c.name]));
  const accountNames = new Map(accountRows.map((a) => [a.id, a.name]));

  function describe(snap: Snapshot | null): { label: string; value: string }[] {
    if (!snap) return [];
    const rows: { label: string; value: string }[] = [];
    if (snap.type) rows.push({ label: "Type", value: snap.type });
    if (snap.accountId) rows.push({ label: "Account", value: accountNames.get(snap.accountId) ?? "Unknown account" });
    if (snap.amount !== undefined) rows.push({ label: "Amount", value: currency(snap.amount) });
    if (snap.date) rows.push({ label: "Date", value: snap.date });
    if (snap.source) rows.push({ label: "Payee", value: snap.source });
    if (snap.notes) rows.push({ label: "Notes", value: snap.notes });
    if (snap.categoryId) rows.push({ label: "Category", value: categoryNames.get(snap.categoryId) ?? "Unknown category" });
    if (snap.splits && snap.splits.length > 0) {
      rows.push({
        label: "Splits",
        value: snap.splits
          .map((s) => `${categoryNames.get(s.categoryId) ?? "Unknown category"}: ${currency(s.amount)}`)
          .join(", "),
      });
    }
    return rows;
  }

  return (
    <div>
      <PageHeader
        eyebrow="What changed, and when"
        title="Transaction History."
        backHref="/transactions"
        backLabel="Transactions"
      />
      {history.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">No changes recorded for this transaction.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => {
            const oldRows = describe(entry.oldValues as Snapshot);
            const newRows = describe(entry.newValues as Snapshot | null);
            return (
              <Card key={entry.id}>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      entry.action === "deleted" ? "bg-danger/12 text-danger" : "bg-accent/12 text-accent"
                    }`}
                  >
                    {entry.action === "deleted" ? "Deleted" : "Edited"}
                  </span>
                  <span className="text-text-muted text-xs">{new Date(entry.changedAt).toLocaleString()}</span>
                </div>
                <div className={`grid grid-cols-1 gap-6 ${entry.action === "updated" ? "sm:grid-cols-2" : ""}`}>
                  <div>
                    <h3 className="text-text-secondary mb-2 text-xs font-medium tracking-wide uppercase">
                      {entry.action === "deleted" ? "At the time it was deleted" : "Before"}
                    </h3>
                    <dl className="space-y-1 text-sm">
                      {oldRows.map((r) => (
                        <div key={r.label} className="flex justify-between gap-4">
                          <dt className="text-text-secondary">{r.label}</dt>
                          <dd className="text-text text-right">{r.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  {entry.action === "updated" ? (
                    <div>
                      <h3 className="text-text-secondary mb-2 text-xs font-medium tracking-wide uppercase">After</h3>
                      <dl className="space-y-1 text-sm">
                        {newRows.map((r) => (
                          <div key={r.label} className="flex justify-between gap-4">
                            <dt className="text-text-secondary">{r.label}</dt>
                            <dd className="text-text text-right">{r.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
