import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listGoals } from "@/lib/goals/queries";

function formatCurrency(amount: string): string {
  return `$${Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function GoalsPage() {
  const { userId } = await verifySession();
  const goals = await listGoals(userId);

  return (
    <main>
      <p>
        <Link href="/">Dashboard</Link>
      </p>
      <h1>Goals</h1>
      <p>
        <Link href="/goals/new">Add goal</Link>
      </p>
      {goals.length === 0 ? (
        <p>No goals yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Progress</th>
              <th>Target Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {goals.map((goal) => {
              const percent =
                goal.allocatedBalance !== null
                  ? Math.min(
                      100,
                      Math.round((Number(goal.allocatedBalance) / Number(goal.targetAmount)) * 100)
                    )
                  : null;
              return (
                <tr key={goal.id}>
                  <td>{goal.name}</td>
                  <td>{goal.categoryName ?? "—"}</td>
                  <td>
                    {goal.allocatedBalance !== null
                      ? `${formatCurrency(goal.allocatedBalance)} of ${formatCurrency(goal.targetAmount)} (${percent}%)`
                      : `Target ${formatCurrency(goal.targetAmount)}`}
                  </td>
                  <td>{goal.targetDate ?? "—"}</td>
                  <td>
                    <Link href={`/goals/${goal.id}/edit`}>Edit</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
