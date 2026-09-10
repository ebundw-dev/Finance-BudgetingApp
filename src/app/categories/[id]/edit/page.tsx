import { notFound } from "next/navigation";
import Link from "next/link";
import { priorityEnum } from "@/db/schema";
import { updateCategory } from "@/lib/categories/actions";
import { verifySession } from "@/lib/auth/dal";
import { getCategory } from "@/lib/categories/queries";

export default async function EditCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { userId } = await verifySession();
  const category = await getCategory(userId, id);

  if (!category) {
    notFound();
  }

  return (
    <main>
      <p>
        <Link href="/categories">Categories</Link>
      </p>
      <h1>Edit {category.name}</h1>
      <form action={updateCategory}>
        <input type="hidden" name="categoryId" value={category.id} />
        <div>
          <label htmlFor="targetAmount">Target amount (leave blank for none)</label>
          <input
            id="targetAmount"
            name="targetAmount"
            type="text"
            inputMode="decimal"
            defaultValue={category.targetAmount ?? ""}
          />
        </div>
        <div>
          <label htmlFor="priority">Priority (used by Quick Payout Allocation)</label>
          <select id="priority" name="priority" defaultValue={category.priority ?? ""}>
            <option value="">None</option>
            {priorityEnum.enumValues.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <button type="submit">Save</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
