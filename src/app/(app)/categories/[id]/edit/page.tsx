import { notFound } from "next/navigation";
import { priorityEnum } from "@/db/schema";
import { deleteCategory, updateCategory } from "@/lib/categories/actions";
import { verifySession } from "@/lib/auth/dal";
import { getCategory } from "@/lib/categories/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { CategoryTargetFields } from "@/components/CategoryTargetFields";
import {
  buttonPrimary,
  checkbox,
  checkboxRow,
  currency,
  errorBanner,
  field,
  input,
  label as labelClass,
  select as selectClass,
} from "@/lib/ui";

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
            <label htmlFor="name" className={labelClass}>
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={category.name}
              className={input}
            />
          </div>
          <p className="mb-4 text-sm text-text-muted">
            Current balance: {currency(category.allocatedBalance)}
          </p>
          <CategoryTargetFields
            initialType={category.targetType}
            initialAmount={category.targetAmount}
            initialCadence={category.targetCadence}
            initialDate={category.targetDate}
          />
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
          <label className={checkboxRow}>
            <input
              type="checkbox"
              name="isArchived"
              defaultChecked={category.isArchived}
              className={checkbox}
            />
            Archive (hides it from Categories, allocation, and Quick Payout — balance is
            preserved and still counts toward Unallocated Cash)
          </label>
          {error ? (
            <p role="alert" className={errorBanner}>
              {error}
            </p>
          ) : null}
          <SubmitButton className={buttonPrimary}>Save</SubmitButton>
        </form>
      </Card>
      <form action={deleteCategory} className="mt-4">
        <input type="hidden" name="categoryId" value={category.id} />
        <ConfirmDeleteButton label="Delete Category" />
      </form>
    </div>
  );
}
