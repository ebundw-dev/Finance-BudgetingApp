import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listAccounts } from "@/lib/accounts/queries";
import { listCategories } from "@/lib/categories/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { ImportWizard } from "@/components/ImportWizard";
import { link } from "@/lib/ui";

export default async function ImportPage() {
  const { userId } = await verifySession();
  const [accounts, categories] = await Promise.all([listAccounts(userId), listCategories(userId)]);

  return (
    <div>
      <PageHeader
        eyebrow="No live bank sync, so this is the bridge"
        title="Import."
        subtitle="Upload a CSV export from your bank or card, map its columns, review before anything posts."
      />

      {accounts.length === 0 || categories.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            Need at least one account and one category first.{" "}
            <Link href="/accounts/new" className={link}>
              Add an account
            </Link>{" "}
            or{" "}
            <Link href="/categories/new" className={link}>
              add a category
            </Link>
            .
          </p>
        </Card>
      ) : (
        <ImportWizard accounts={accounts} categories={categories} />
      )}
    </div>
  );
}
