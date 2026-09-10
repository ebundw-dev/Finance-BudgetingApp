// One-time setup: creates the default category taxonomy from
// PROJECT_BRIEF.md's "Default seed categories" list for ADMIN_EMAIL (.env).
// Every category starts at $0 allocated_balance with no target_amount or
// priority set -- those are personal decisions left for the category
// management screen (/categories), not invented here.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const [user] = await sql`select id from users where email = ${adminEmail}`;
if (!user) {
  console.error(`No user found for ADMIN_EMAIL=${process.env.ADMIN_EMAIL}`);
  process.exit(1);
}

const GROUPS = [
  {
    name: "ESSENTIALS",
    categoryType: "spending",
    categories: [
      "Rent/household",
      "Food",
      "Gas",
      "Phone",
      "Insurance",
      "Subscriptions",
      "Other bills",
    ],
  },
  {
    name: "DEBT",
    categoryType: "spending",
    categories: ["Credit Card 1", "Credit Card 2", "Collections", "Other Debt"],
  },
  {
    name: "STABILITY",
    categoryType: "goal",
    categories: ["Emergency Fund", "General Cash Reserve"],
  },
  {
    name: "FREEDOM",
    categoryType: "goal",
    categories: ["Car Fund", "Move-Out Fund", "Investments"],
  },
  {
    name: "LIFE",
    categoryType: "spending",
    categories: ["Travel", "Dates/Social", "Entertainment", "Shopping", "Miscellaneous"],
  },
];

for (let g = 0; g < GROUPS.length; g++) {
  const group = GROUPS[g];

  const [existingGroup] = await sql`
    select id from category_groups where user_id = ${user.id} and name = ${group.name}
  `;
  const groupId = existingGroup
    ? existingGroup.id
    : (
        await sql`
          insert into category_groups (id, user_id, name, sort_order)
          values (${randomUUID()}, ${user.id}, ${group.name}, ${g})
          returning id
        `
      )[0].id;

  for (let c = 0; c < group.categories.length; c++) {
    const name = group.categories[c];
    const [existing] = await sql`
      select id from categories where user_id = ${user.id} and group_id = ${groupId} and name = ${name}
    `;
    if (existing) continue;

    await sql`
      insert into categories (id, user_id, group_id, name, category_type, allocated_balance, sort_order)
      values (${randomUUID()}, ${user.id}, ${groupId}, ${name}, ${group.categoryType}, '0', ${c})
    `;
  }
}

console.log("Seeded default category taxonomy.");
