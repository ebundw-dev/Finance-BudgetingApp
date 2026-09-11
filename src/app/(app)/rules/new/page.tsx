import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listCategories } from "@/lib/categories/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { RuleSetForm } from "@/components/RuleSetForm";
import { link } from "@/lib/ui";

export default async function NewRuleSetPage() {
  const { userId } = await verifySession();
  const categories = await listCategories(userId);

  return (
    <div className="max-w-md">
      <PageHeader title="New Rule Set" backHref="/rules" backLabel="Rule Sets" />
      {categories.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            No categories yet.{" "}
            <Link href="/categories/new" className={link}>
              Add one
            </Link>{" "}
            first.
          </p>
        </Card>
      ) : (
        <Card>
          <RuleSetForm categories={categories} />
        </Card>
      )}
    </div>
  );
}
