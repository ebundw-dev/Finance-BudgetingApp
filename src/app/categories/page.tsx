import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listCategoryGroupsWithCategories } from "@/lib/categories/queries";

function formatCurrency(amount: string): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function CategoriesPage() {
  const { userId } = await verifySession();
  const groups = await listCategoryGroupsWithCategories(userId);

  return (
    <main>
      <p>
        <Link href="/">Dashboard</Link>
      </p>
      <h1>Categories</h1>
      <p>
        <Link href="/categories/new">Add category</Link>
      </p>
      {groups.map((group) => (
        <section key={group.id}>
          <h2>{group.name}</h2>
          {group.categories.length === 0 ? (
            <p>No categories in this group.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Balance</th>
                  <th>Target</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {group.categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{category.categoryType}</td>
                    <td>{category.priority ?? "—"}</td>
                    <td>{formatCurrency(category.allocatedBalance)}</td>
                    <td>{category.targetAmount ? formatCurrency(category.targetAmount) : "—"}</td>
                    <td>
                      <Link href={`/categories/${category.id}/edit`}>Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </main>
  );
}
