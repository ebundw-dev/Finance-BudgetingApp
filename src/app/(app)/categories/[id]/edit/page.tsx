import { notFound } from "next/navigation";
import { priorityEnum } from "@/db/schema";
import { updateCategory } from "@/lib/categories/actions";
import { verifySession } from "@/lib/auth/dal";
import { getCategory } from "@/lib/categories/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { buttonPrimary, errorBanner, field, input, label as labelClass, select as selectClass } from "@/lib/ui";

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
    <div>
      <PageHeader title={`Edit ${category.name}`} backHref="/categories" backLabel="Categories" />
      <Card className="max-w-md">
        <form action={updateCategory}>
          <input type="hidden" name="categoryId" value={category.id} />
          <div className={field}>
            <label htmlFor="targetAmount" className={labelClass}>
              Target amount (leave blank for none)
            </label>
            <input
              id="targetAmount"
              name="targetAmount"
              type="text"
              inputMode="decimal"
              defaultValue={category.targetAmount ?? ""}
              className={input}
            />
          </div>
          <div className={field}>
            <label htmlFor="priority" className={labelClass}>
              Priority (used by Quick Payout Allocation)
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue={category.priority ?? ""}
              className={selectClass}
            >
              <option value="">None</option>
              {priorityEnum.enumValues.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {error ? (
            <p role="alert" className={errorBanner}>
              {error}
            </p>
          ) : null}
          <button type="submit" className={buttonPrimary}>
            Save
          </button>
        </form>
      </Card>
    </div>
  );
}
