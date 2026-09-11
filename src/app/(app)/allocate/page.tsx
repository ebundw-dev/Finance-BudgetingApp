import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listCategories, listPriorityCategories } from "@/lib/categories/queries";
import { getUnallocatedCash } from "@/lib/allocation/queries";
import { allocateAction } from "@/lib/allocation/actions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { AllocationForm } from "@/components/AllocationForm";
import { buttonSecondary, errorBanner, successBanner } from "@/lib/ui";

export default async function AllocatePage({
  searchParams,
}: {
  searchParams: Promise<{ priority?: string; error?: string; success?: string }>;
}) {
  const { priority, error, success } = await searchParams;
  const showPriorityOnly = priority === "1";
  const { userId } = await verifySession();

  const [unallocated, categories] = await Promise.all([
    getUnallocatedCash(userId),
    showPriorityOnly ? listPriorityCategories(userId) : listCategories(userId),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Assign cash"
        title="Allocate."
        subtitle="Give every dollar a job before it has a chance to disappear."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={showPriorityOnly ? "/allocate" : "/allocate?priority=1"}
          className={buttonSecondary}
        >
          {showPriorityOnly ? "Show all categories" : "Show priority categories only"}
        </Link>
        <Link href="/allocate/auto" className={buttonSecondary}>
          Auto-Allocate
        </Link>
        <Link href="/allocate/quick" className={buttonSecondary}>
          Quick Payout Allocation
        </Link>
      </div>

      {success ? (
        <p role="status" className={successBanner}>
          {success}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className={errorBanner}>
          {error}
        </p>
      ) : null}

      {categories.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            {showPriorityOnly
              ? "No categories are tagged with a priority yet. Set one from the category edit screen."
              : "No categories yet."}
          </p>
        </Card>
      ) : (
        <AllocationForm
          categories={categories}
          unallocatedCash={unallocated}
          showPriorityOnly={showPriorityOnly}
          action={allocateAction}
        />
      )}
    </div>
  );
}
