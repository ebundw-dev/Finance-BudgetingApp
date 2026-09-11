import { verifySession } from "@/lib/auth/dal";
import { listRuleSetNames } from "@/lib/rules/queries";
import { getUnallocatedCash } from "@/lib/allocation/queries";
import { applyRuleSetAction } from "@/lib/allocation/actions";
import { PageHeader } from "@/components/PageHeader";
import { Card, StatCard } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";
import { buttonPrimary, errorBanner, field, input, label as labelClass, link, select as selectClass } from "@/lib/ui";

export default async function AutoAllocatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { userId } = await verifySession();
  const [ruleNames, unallocated] = await Promise.all([
    listRuleSetNames(userId),
    getUnallocatedCash(userId),
  ]);

  return (
    <div className="max-w-md">
      <PageHeader title="Auto-Allocate" backHref="/allocate" backLabel="Allocate" />
      <div className="mb-6">
        <StatCard label="Unallocated Cash" value={`$${Number(unallocated).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} />
      </div>
      {ruleNames.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            No rule sets yet.{" "}
            <Link href="/rules/new" className={link}>
              Create one
            </Link>{" "}
            first.
          </p>
        </Card>
      ) : (
        <Card>
          <form action={applyRuleSetAction}>
            <div className={field}>
              <label htmlFor="ruleName" className={labelClass}>
                Rule set
              </label>
              <select id="ruleName" name="ruleName" required className={selectClass}>
                {ruleNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className={field}>
              <label htmlFor="amount" className={labelClass}>
                Amount to split
              </label>
              <input
                id="amount"
                name="amount"
                type="text"
                inputMode="decimal"
                defaultValue={unallocated}
                required
                className={input}
              />
            </div>
            {error ? (
              <p role="alert" className={errorBanner}>
                {error}
              </p>
            ) : null}
            <SubmitButton className={buttonPrimary} pendingLabel="Applying…">
              Apply
            </SubmitButton>
          </form>
        </Card>
      )}
    </div>
  );
}
