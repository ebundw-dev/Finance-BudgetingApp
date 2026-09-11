import { createGoal } from "@/lib/goals/actions";
import { verifySession } from "@/lib/auth/dal";
import { listCategories } from "@/lib/categories/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { buttonPrimary, errorBanner, field, input, label as labelClass, select as selectClass } from "@/lib/ui";

export default async function NewGoalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { userId } = await verifySession();
  const categories = await listCategories(userId);

  return (
    <div>
      <PageHeader title="Add Goal" backHref="/goals" backLabel="Goals" />
      <Card className="max-w-md">
        <form action={createGoal}>
          <div className={field}>
            <label htmlFor="name" className={labelClass}>
              Name
            </label>
            <input id="name" name="name" type="text" required autoFocus className={input} />
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
              required
              className={input}
            />
          </div>
          <div className={field}>
            <label htmlFor="targetDate" className={labelClass}>
              Target date (optional)
            </label>
            <input id="targetDate" name="targetDate" type="date" className={input} />
          </div>
          <div className={field}>
            <label htmlFor="categoryId" className={labelClass}>
              Linked category (optional)
            </label>
            <select id="categoryId" name="categoryId" defaultValue="" className={selectClass}>
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
          <button type="submit" className={buttonPrimary}>
            Create Goal
          </button>
        </form>
      </Card>
    </div>
  );
}
