import Link from "next/link";
import { verifySession } from "@/lib/auth/dal";
import { listCategories } from "@/lib/categories/queries";
import { createRuleSet } from "@/lib/rules/actions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonPrimary, errorBanner, field, input, label as labelClass, link, select as selectClass } from "@/lib/ui";

const ROW_COUNT = 8;

export default async function NewRuleSetPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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
          <form action={createRuleSet}>
            <div className={field}>
              <label htmlFor="ruleName" className={labelClass}>
                Name
              </label>
              <input id="ruleName" name="ruleName" type="text" required autoFocus className={input} />
            </div>
            <p className="mb-3 text-xs text-text-muted">
              Leave a row blank to skip it. Percentages across all filled-in rows must sum to 100.
            </p>
            <div className="mb-4 space-y-2">
              {Array.from({ length: ROW_COUNT }).map((_, i) => (
                <div key={i} className="flex gap-2">
                  <select name="categoryId[]" defaultValue="" className={selectClass}>
                    <option value="">— none —</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <input
                    name="percentage[]"
                    type="text"
                    inputMode="decimal"
                    placeholder="%"
                    className={`${input} w-20`}
                  />
                </div>
              ))}
            </div>
            {error ? (
              <p role="alert" className={errorBanner}>
                {error}
              </p>
            ) : null}
            <SubmitButton className={buttonPrimary} pendingLabel="Creating…">
              Create Rule Set
            </SubmitButton>
          </form>
        </Card>
      )}
    </div>
  );
}
