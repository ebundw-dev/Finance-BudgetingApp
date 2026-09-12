import { verifySession } from "@/lib/auth/dal";
import { listPayeesForDisplay } from "@/lib/payees/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { table, td, th } from "@/lib/ui";

export default async function PayeesPage() {
  const { userId } = await verifySession();
  const payees = await listPayeesForDisplay(userId);

  return (
    <div>
      <PageHeader
        eyebrow="Data entry helper"
        title="Payees."
        subtitle="Every payee entered on an expense, and which category it was last assigned to. Spot near-duplicates here (like “Amazon” vs “amazon.com”) and pick one spelling going forward — this list is for review, it doesn't merge them automatically."
      />

      {payees.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            No payees yet. They&apos;re created automatically as you enter expenses with a
            merchant / payee name.
          </p>
        </Card>
      ) : (
        <Card padded={false} className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Payee</th>
                <th className={th}>Last category</th>
                <th className={th}>Times used</th>
              </tr>
            </thead>
            <tbody>
              {payees.map((payee) => (
                <tr key={payee.id} className="hover:bg-surface-hover/60 transition-colors">
                  <td className={td}>{payee.name}</td>
                  <td className={td}>{payee.lastCategoryName ?? "—"}</td>
                  <td className={`${td} tabular-nums`}>{payee.useCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
