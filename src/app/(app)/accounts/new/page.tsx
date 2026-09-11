import { accountTypeEnum } from "@/db/schema";
import { createAccount } from "@/lib/accounts/actions";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import {
  buttonPrimary,
  checkbox,
  checkboxRow,
  errorBanner,
  field,
  input,
  label as labelClass,
  select as selectClass,
} from "@/lib/ui";

export default async function NewAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <PageHeader title="Add Account" backHref="/accounts" backLabel="Accounts" />
      <Card className="max-w-md">
        <form action={createAccount}>
          <div className={field}>
            <label htmlFor="name" className={labelClass}>
              Name
            </label>
            <input id="name" name="name" type="text" required autoFocus className={input} />
          </div>
          <div className={field}>
            <label htmlFor="type" className={labelClass}>
              Type
            </label>
            <select id="type" name="type" defaultValue="checking" className={selectClass}>
              {accountTypeEnum.enumValues.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className={field}>
            <label htmlFor="currentBalance" className={labelClass}>
              Starting balance
            </label>
            <input
              id="currentBalance"
              name="currentBalance"
              type="text"
              inputMode="decimal"
              defaultValue="0.00"
              className={input}
            />
          </div>
          <label className={checkboxRow}>
            <input type="checkbox" name="isCashAccount" defaultChecked className={checkbox} />
            This is a cash account (checking/savings/cash)
          </label>
          <label className={checkboxRow}>
            <input type="checkbox" name="isDebt" className={checkbox} />
            Track this as a debt (creates a linked reserve category)
          </label>
          {error ? (
            <p role="alert" className={errorBanner}>
              {error}
            </p>
          ) : null}
          <SubmitButton className={`${buttonPrimary} mt-2`} pendingLabel="Creating…">
            Create Account
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
