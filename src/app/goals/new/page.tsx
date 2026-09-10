import Link from "next/link";
import { createGoal } from "@/lib/goals/actions";
import { verifySession } from "@/lib/auth/dal";
import { listCategories } from "@/lib/categories/queries";

export default async function NewGoalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { userId } = await verifySession();
  const categories = await listCategories(userId);

  return (
    <main>
      <p>
        <Link href="/goals">Goals</Link>
      </p>
      <h1>Add Goal</h1>
      <form action={createGoal}>
        <div>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required autoFocus />
        </div>
        <div>
          <label htmlFor="targetAmount">Target amount</label>
          <input id="targetAmount" name="targetAmount" type="text" inputMode="decimal" required />
        </div>
        <div>
          <label htmlFor="targetDate">Target date (optional)</label>
          <input id="targetDate" name="targetDate" type="date" />
        </div>
        <div>
          <label htmlFor="categoryId">Linked category (optional)</label>
          <select id="categoryId" name="categoryId" defaultValue="">
            <option value="">— none —</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit">Create Goal</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
