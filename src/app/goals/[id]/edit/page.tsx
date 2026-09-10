import { notFound } from "next/navigation";
import Link from "next/link";
import { deleteGoal, updateGoal } from "@/lib/goals/actions";
import { verifySession } from "@/lib/auth/dal";
import { getGoal } from "@/lib/goals/queries";
import { listCategories } from "@/lib/categories/queries";

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
    <main>
      <p>
        <Link href="/goals">Goals</Link>
      </p>
      <h1>Edit {goal.name}</h1>
      <form action={updateGoal}>
        <input type="hidden" name="goalId" value={goal.id} />
        <div>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" defaultValue={goal.name} required />
        </div>
        <div>
          <label htmlFor="targetAmount">Target amount</label>
          <input
            id="targetAmount"
            name="targetAmount"
            type="text"
            inputMode="decimal"
            defaultValue={goal.targetAmount}
            required
          />
        </div>
        <div>
          <label htmlFor="targetDate">Target date (optional)</label>
          <input id="targetDate" name="targetDate" type="date" defaultValue={goal.targetDate ?? ""} />
        </div>
        <div>
          <label htmlFor="categoryId">Linked category (optional)</label>
          <select id="categoryId" name="categoryId" defaultValue={goal.categoryId ?? ""}>
            <option value="">— none —</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit">Save</button>
      </form>
      <form action={deleteGoal}>
        <input type="hidden" name="goalId" value={goal.id} />
        <button type="submit">Delete Goal</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
