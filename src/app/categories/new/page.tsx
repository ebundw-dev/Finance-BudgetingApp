import Link from "next/link";
import { categoryTypeEnum } from "@/db/schema";
import { createCategory, createCategoryGroup } from "@/lib/categories/actions";
import { verifySession } from "@/lib/auth/dal";
import { listCategoryGroups } from "@/lib/categories/queries";

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { userId } = await verifySession();
  const groups = await listCategoryGroups(userId);

  return (
    <main>
      <p>
        <Link href="/categories">Categories</Link>
      </p>
      <h1>Add Category</h1>

      <section>
        <h2>New group</h2>
        <form action={createCategoryGroup}>
          <input name="name" type="text" placeholder="Group name" required />
          <button type="submit">Add Group</button>
        </form>
      </section>

      {groups.length === 0 ? (
        <p>Add a group above first, then a category can go in it.</p>
      ) : (
        <form action={createCategory}>
          <div>
            <label htmlFor="groupId">Group</label>
            <select id="groupId" name="groupId" required>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" required autoFocus />
          </div>
          <div>
            <label htmlFor="categoryType">Type</label>
            <select id="categoryType" name="categoryType" defaultValue="spending">
              {categoryTypeEnum.enumValues.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Create Category</button>
        </form>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
