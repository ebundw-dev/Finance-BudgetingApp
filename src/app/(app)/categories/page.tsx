import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listArchivedCategories, listCategoryGroupsWithCategories } from "@/lib/categories/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { ProgressBar } from "@/components/ProgressBar";
import { buttonPrimary, currency, link, table, td, th } from "@/lib/ui";

const TYPE_BADGE: Record<string, string> = {
  spending: "bg-accent/12 text-accent",
  goal: "bg-success/12 text-success",
};

const PRIORITY_BADGE: Record<string, string> = {
  P1: "bg-danger/12 text-danger",
  P2: "bg-warning/12 text-warning",
  P3: "bg-accent/12 text-accent",
  P4: "bg-text-secondary/10 text-text-secondary",
};

export default async function CategoriesPage() {
  const { userId } = await verifySession();
  const [groups, archived] = await Promise.all([
    listCategoryGroupsWithCategories(userId),
    listArchivedCategories(userId),
  ]);

  return (
    <div>
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Name what matters"
          title="Categories."
          subtitle="Turn a pile of transactions into a set of choices you can feel good about."
        />
        <Link href="/categories/new" className={`${buttonPrimary} mt-1`}>
          Add category
        </Link>
      </div>
      <div className="space-y-6">
        {groups.map((group) => (
          <Card key={group.id} padded={false}>
            <h2 className="border-b border-border px-6 py-4 text-sm font-medium tracking-wide text-text-secondary uppercase">
              {group.name}
            </h2>
            {group.categories.length === 0 ? (
              <p className="px-6 py-5 text-sm text-text-muted">No categories in this group.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className={table}>
                  <thead>
                    <tr>
                      <th className={th}>Name</th>
                      <th className={th}>Type</th>
                      <th className={th}>Priority</th>
                      <th className={th}>Balance</th>
                      <th className={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.categories.map((category) => {
                      const percent = category.targetAmount
                        ? Math.round(
                            (Number(category.allocatedBalance) / Number(category.targetAmount)) * 100
                          )
                        : null;
                      return (
                        <tr key={category.id} className="hover:bg-surface-hover/60 transition-colors">
                          <td className={td}>{category.name}</td>
                          <td className={td}>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[category.categoryType] ?? "bg-surface-hover text-text-secondary"}`}
                            >
                              {category.categoryType}
                            </span>
                          </td>
                          <td className={td}>
                            {category.priority ? (
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[category.priority] ?? "bg-surface-hover text-text-secondary"}`}
                              >
                                {category.priority}
                              </span>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                          </td>
                          <td className={`${td} tabular-nums`}>
                            {percent !== null ? (
                              <div className="min-w-32">
                                <div className="mb-1 flex justify-between text-xs text-text-secondary">
                                  <span>{currency(category.allocatedBalance)}</span>
                                  <span>of {currency(category.targetAmount!)}</span>
                                </div>
                                <ProgressBar percent={percent} />
                              </div>
                            ) : (
                              currency(category.allocatedBalance)
                            )}
                          </td>
                          <td className={td}>
                            <Link href={`/categories/${category.id}/edit`} className={link}>
                              Edit
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))}
        {archived.length > 0 ? (
          <Card padded={false}>
            <h2 className="border-b border-border px-6 py-4 text-sm font-medium tracking-wide text-text-secondary uppercase">
              Archived
            </h2>
            <div className="overflow-x-auto">
              <table className={table}>
                <thead>
                  <tr>
                    <th className={th}>Name</th>
                    <th className={th}>Balance</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {archived.map((category) => (
                    <tr key={category.id} className="hover:bg-surface-hover/60 transition-colors">
                      <td className={`${td} text-text-muted`}>{category.name}</td>
                      <td className={`${td} tabular-nums text-text-muted`}>
                        {currency(category.allocatedBalance)}
                      </td>
                      <td className={td}>
                        <Link href={`/categories/${category.id}/edit`} className={link}>
                          Edit / Unarchive
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
