import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listTransactionsPaginated } from "@/lib/transactions/queries";
import { listAccounts } from "@/lib/accounts/queries";
import { listCategories } from "@/lib/categories/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import {
  buttonPrimary,
  buttonSecondary,
  currency,
  field,
  input as inputClass,
  label as labelClass,
  link,
  select as selectClass,
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
  reconciliation: "Reconciliation",
};

const TYPE_BADGE: Record<string, string> = {
  income: "bg-success/12 text-success",
  allocation: "bg-accent/12 text-accent",
  expense: "bg-danger/12 text-danger",
  debt_payment: "bg-warning/12 text-warning",
  transfer: "bg-text-secondary/10 text-text-secondary",
  category_reallocation: "bg-text-secondary/10 text-text-secondary",
  reconciliation: "bg-info/12 text-info",
};

const PAGE_SIZE = 50;

interface SearchParams {
  search?: string;
  accountId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
  offset?: string;
  success?: string;
}

function buildQuery(params: SearchParams, overrides: Partial<SearchParams>): string {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (key === "success") continue;
    if (value) qs.set(key, value);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { userId } = await verifySession();
  const params = await searchParams;
  const offset = params.offset ? Math.max(0, Number(params.offset) || 0) : 0;

  const [{ rows, total }, accounts, categories] = await Promise.all([
    listTransactionsPaginated(userId, {
      search: params.search,
      accountId: params.accountId,
      categoryId: params.categoryId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      amountMin: params.amountMin,
      amountMax: params.amountMax,
      limit: PAGE_SIZE,
      offset,
    }),
    listAccounts(userId),
    listCategories(userId),
  ]);

  const hasFilters = Boolean(
    params.search || params.accountId || params.categoryId || params.dateFrom || params.dateTo || params.amountMin || params.amountMax
  );
  const hasPrev = offset > 0;
  const hasNext = offset + rows.length < total;

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Every dollar, accounted for"
          title="Transactions."
          subtitle="The full record — nothing hidden, nothing rounded away."
        />
        <div className="mt-1 flex flex-wrap gap-2">
          <Link href="/income/new" className={buttonSecondary}>
            Record income
          </Link>
          <Link href="/transactions/new" className={buttonSecondary}>
            New transaction
          </Link>
          <Link href="/allocate" className={buttonPrimary}>
            Allocate
          </Link>
        </div>
      </div>
      {params.success ? (
        <p role="status" className={successBanner}>
          {params.success}
        </p>
      ) : null}

      <Card className="mb-6">
        <form method="GET" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className={`${field} col-span-2 mb-0 sm:col-span-1`}>
            <label htmlFor="search" className={labelClass}>
              Payee / description
            </label>
            <input
              id="search"
              name="search"
              type="text"
              defaultValue={params.search ?? ""}
              placeholder="e.g. Costco"
              className={inputClass}
            />
          </div>
          <div className={`${field} mb-0`}>
            <label htmlFor="categoryId" className={labelClass}>
              Category
            </label>
            <select id="categoryId" name="categoryId" defaultValue={params.categoryId ?? ""} className={selectClass}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className={`${field} mb-0`}>
            <label htmlFor="accountId" className={labelClass}>
              Account
            </label>
            <select id="accountId" name="accountId" defaultValue={params.accountId ?? ""} className={selectClass}>
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className={`${field} mb-0`}>
            <label htmlFor="dateFrom" className={labelClass}>
              From
            </label>
            <input id="dateFrom" name="dateFrom" type="date" defaultValue={params.dateFrom ?? ""} className={inputClass} />
          </div>
          <div className={`${field} mb-0`}>
            <label htmlFor="dateTo" className={labelClass}>
              To
            </label>
            <input id="dateTo" name="dateTo" type="date" defaultValue={params.dateTo ?? ""} className={inputClass} />
          </div>
          <div className="mb-0 flex gap-2">
            <div className={field}>
              <label htmlFor="amountMin" className={labelClass}>
                Min $
              </label>
              <input
                id="amountMin"
                name="amountMin"
                type="text"
                inputMode="decimal"
                defaultValue={params.amountMin ?? ""}
                className={inputClass}
              />
            </div>
            <div className={field}>
              <label htmlFor="amountMax" className={labelClass}>
                Max $
              </label>
              <input
                id="amountMax"
                name="amountMax"
                type="text"
                inputMode="decimal"
                defaultValue={params.amountMax ?? ""}
                className={inputClass}
              />
            </div>
          </div>
          <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-6">
            <button type="submit" className={buttonPrimary}>
              Apply filters
            </button>
            {hasFilters ? (
              <Link href="/transactions" className={buttonSecondary}>
                Clear
              </Link>
            ) : null}
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            {hasFilters ? "No transactions match these filters." : "No transactions yet."}
          </p>
        </Card>
      ) : (
        <>
          <Card padded={false} className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Type</th>
                  <th className={th}>Account</th>
                  <th className={th}>Category</th>
                  <th className={th}>Amount</th>
                  <th className={th}>Source / Notes</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className={`${td} whitespace-nowrap`}>{row.date}</td>
                    <td className={td}>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TYPE_BADGE[row.type] ?? "bg-surface-hover text-text-secondary"}`}
                      >
                        {TYPE_LABELS[row.type] ?? row.type}
                      </span>
                    </td>
                    <td className={td}>
                      {row.accountName ?? "—"}
                      {row.relatedAccountName ? ` → ${row.relatedAccountName}` : ""}
                    </td>
                    <td className={td}>
                      {row.splits.length > 0 ? (
                        <details>
                          <summary className="cursor-pointer list-none">
                            <span className="rounded-full bg-accent/12 px-2 py-0.5 text-xs font-medium text-accent">
                              Split ({row.splits.length})
                            </span>
                          </summary>
                          <ul className="mt-2 space-y-1 text-xs text-text-secondary">
                            {row.splits.map((s) => (
                              <li key={s.categoryId} className="flex justify-between gap-4">
                                <span>{s.categoryName}</span>
                                <span className="tabular-nums">{currency(s.amount)}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : (
                        <>
                          {row.categoryName ?? "—"}
                          {row.relatedCategoryName ? ` → ${row.relatedCategoryName}` : ""}
                        </>
                      )}
                    </td>
                    <td className={`${td} tabular-nums`}>{currency(row.amount)}</td>
                    <td className={`${td} text-text-secondary`}>{row.source ?? row.notes ?? ""}</td>
                    <td className={td}>
                      <div className="flex gap-3">
                        {row.splits.length > 0 ? (
                          <Link href={`/transactions/${row.id}/edit`} className={link}>
                            Edit
                          </Link>
                        ) : null}
                        <Link href={`/transactions/${row.id}/history`} className={link}>
                          History
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
            <span>
              {offset + 1}–{offset + rows.length} of {total}
            </span>
            <div className="flex gap-2">
              {hasPrev ? (
                <Link href={buildQuery(params, { offset: String(Math.max(0, offset - PAGE_SIZE)) })} className={buttonSecondary}>
                  &larr; Previous
                </Link>
              ) : null}
              {hasNext ? (
                <Link href={buildQuery(params, { offset: String(offset + PAGE_SIZE) })} className={buttonSecondary}>
                  Next &rarr;
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
