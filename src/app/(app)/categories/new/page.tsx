import { categoryTypeEnum } from "@/db/schema";
import { createCategory, createCategoryGroup } from "@/lib/categories/actions";
import { verifySession } from "@/lib/auth/dal";
import { listCategoryGroups } from "@/lib/categories/queries";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SubmitButton } from "@/components/SubmitButton";
import {
  buttonPrimary,
  buttonSecondary,
  errorBanner,
  field,
  input,
  label as labelClass,
  select as selectClass,
} from "@/lib/ui";

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { userId } = await verifySession();
  const groups = await listCategoryGroups(userId);

  return (
    <div className="max-w-md space-y-6">
      <PageHeader title="Add Category" backHref="/categories" backLabel="Categories" />

      <Card>
        <h2 className="mb-3 text-sm font-medium tracking-wide text-text-secondary uppercase">
          New group
        </h2>
        <form action={createCategoryGroup} className="flex gap-2">
          <input name="name" type="text" placeholder="Group name" required className={input} />
          <SubmitButton className={buttonSecondary} pendingLabel="Adding…">
            Add Group
          </SubmitButton>
        </form>
      </Card>

      {groups.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            Add a group above first, then a category can go in it.
          </p>
        </Card>
      ) : (
        <Card>
          <form action={createCategory}>
            <div className={field}>
              <label htmlFor="groupId" className={labelClass}>
                Group
              </label>
              <select id="groupId" name="groupId" required className={selectClass}>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={field}>
              <label htmlFor="name" className={labelClass}>
                Name
              </label>
              <input id="name" name="name" type="text" required autoFocus className={input} />
            </div>
            <div className={field}>
              <label htmlFor="categoryType" className={labelClass}>
                Type
              </label>
              <select
                id="categoryType"
                name="categoryType"
                defaultValue="spending"
                className={selectClass}
              >
                {categoryTypeEnum.enumValues.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            {error ? (
              <p role="alert" className={errorBanner}>
                {error}
              </p>
            ) : null}
            <SubmitButton className={buttonPrimary} pendingLabel="Creating…">
              Create Category
            </SubmitButton>
          </form>
        </Card>
      )}
    </div>
  );
}
