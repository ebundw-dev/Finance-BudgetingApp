import { notFound } from "next/navigation";
import { deleteGoal, updateGoal } from "@/lib/goals/actions";
import { verifySession } from "@/lib/auth/dal";
import { getGoal } from "@/lib/goals/queries";
import { listCategories } from "@/lib/categories/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonDanger, buttonPrimary, errorBanner, field, input, label as labelClass, select as selectClass } from "@/lib/ui";

export default async function EditGoalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { userId } = await verifySession();
  const [goal, categories] = await Promise.all([getGoal(userId, id), listCategories(userId)]);

  if (!goal) {
    notFound();
  }

  return (
    <div>
      <PageHeader title={`Edit ${goal.name}`} backHref="/goals" backLabel="Goals" />
      <Card className="max-w-md">
        <form action={updateGoal}>
          <input type="hidden" name="goalId" value={goal.id} />
          <div className={field}>
            <label htmlFor="name" className={labelClass}>
              Name
            </label>
            <input id="name" name="name" type="text" defaultValue={goal.name} required className={input} />
          </div>
          <div className={field}>
            <label htmlFor="targetAmount" className={labelClass}>
              Target amount
            </label>
            <input
              id="targetAmount"
              name="targetAmount"
              type="text"
              inputMode="decimal"
              defaultValue={goal.targetAmount}
              required
              className={input}
            />
          </div>
          <div className={field}>
            <label htmlFor="targetDate" className={labelClass}>
              Target date (optional)
            </label>
            <input
              id="targetDate"
              name="targetDate"
              type="date"
              defaultValue={goal.targetDate ?? ""}
              className={input}
            />
          </div>
          <div className={field}>
            <label htmlFor="categoryId" className={labelClass}>
              Linked category (optional)
            </label>
            <select id="categoryId" name="categoryId" defaultValue={goal.categoryId ?? ""} className={selectClass}>
              <option value="">— none —</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          {error ? (
            <p role="alert" className={errorBanner}>
              {error}
            </p>
          ) : null}
          <SubmitButton className={buttonPrimary}>Save</SubmitButton>
        </form>
      </Card>
      <form action={deleteGoal} className="mt-4">
        <input type="hidden" name="goalId" value={goal.id} />
        <SubmitButton className={buttonDanger} pendingLabel="Deleting…">
          Delete Goal
        </SubmitButton>
      </form>
    </div>
  );
}
