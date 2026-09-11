import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listArchivedCategories, listCategoryGroupsWithCategories } from "@/lib/categories/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { buttonPrimary, currency, link, table, td, th } from "@/lib/ui";

export default async function CategoriesPage() {
  const { userId } = await verifySession();
  const [groups, archived] = await Promise.all([
    listCategoryGroupsWithCategories(userId),
    listArchivedCategories(userId),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Categories" />
        <Link href="/categories/new" className={buttonPrimary}>
          Add category
        </Link>
      </div>
      <div className="space-y-6">
        {groups.map((group) => (
          <Card key={group.id} padded={false}>
            <h2 className="border-b border-border px-5 py-3 text-sm font-medium tracking-wide text-text-secondary uppercase">
              {group.name}
            </h2>
            {group.categories.length === 0 ? (
              <p className="px-5 py-4 text-sm text-text-muted">No categories in this group.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className={table}>
                  <thead>
                    <tr>
                      <th className={th}>Name</th>
                      <th className={th}>Type</th>
                      <th className={th}>Priority</th>
                      <th className={th}>Balance</th>
                      <th className={th}>Target</th>
                      <th className={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.categories.map((category) => (
                      <tr key={category.id}>
                        <td className={td}>{category.name}</td>
                        <td className={td}>{category.categoryType}</td>
                        <td className={td}>{category.priority ?? "—"}</td>
                        <td className={`${td} tabular-nums`}>
                          {currency(category.allocatedBalance)}
                        </td>
                        <td className={`${td} tabular-nums`}>
                          {category.targetAmount ? currency(category.targetAmount) : "—"}
                        </td>
                        <td className={td}>
                          <Link href={`/categories/${category.id}/edit`} className={link}>
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))}
        {archived.length > 0 ? (
          <Card padded={false}>
            <h2 className="border-b border-border px-5 py-3 text-sm font-medium tracking-wide text-text-secondary uppercase">
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
                    <tr key={category.id}>
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
