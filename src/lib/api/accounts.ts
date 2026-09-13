import { and, eq, ilike } from "drizzle-orm";
import { accounts, accountTypeEnum, categories, categoryGroups, debts } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/accounting/errors";
import type { Tx } from "@/lib/accounting/engine";

const ACCOUNT_TYPES = new Set(accountTypeEnum.enumValues);
type AccountTypeValue = (typeof accountTypeEnum.enumValues)[number];

function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${key} is required.`);
  }
  return value;
}

export interface CreateAccountInput {
  name: string;
  type: AccountTypeValue;
  currentBalance: string;
  isCashAccount: boolean;
  isDebt: boolean;
}

// Mirrors src/lib/accounts/actions.ts's createAccount Server Action
// exactly (same validation, same "track as debt" reserve-category setup
// per CLAUDE.md's debt reserve category mechanic) -- a separate copy, not
// an extracted shared function, so the web app's own action file stays
// untouched. Keep both in sync by hand if account creation rules change.
export function parseCreateAccountInput(body: unknown): CreateAccountInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("A JSON request body is required.");
  }
  const record = body as Record<string, unknown>;
  const name = requireString(record, "name").trim();
  const type = requireString(record, "type");
  if (!ACCOUNT_TYPES.has(type as AccountTypeValue)) {
    throw new ValidationError("Name and a valid account type are required.");
  }
  const currentBalanceRaw = typeof record.currentBalance === "string" ? record.currentBalance.trim() : "";
  const currentBalance = currentBalanceRaw || "0";
  if (Number.isNaN(Number(currentBalance))) {
    throw new ValidationError("Starting balance must be a number.");
  }
  return {
    name,
    type: type as AccountTypeValue,
    currentBalance,
    isCashAccount: record.isCashAccount !== false,
    isDebt: record.isDebt === true,
  };
}

export async function createAccount(tx: Tx, userId: string, input: CreateAccountInput) {
  const [account] = await tx
    .insert(accounts)
    .values({
      userId,
      name: input.name,
      type: input.type,
      isCashAccount: input.isCashAccount,
      currentBalance: input.currentBalance,
    })
    .returning();

  if (input.isDebt) {
    let [group] = await tx
      .select()
      .from(categoryGroups)
      .where(and(eq(categoryGroups.userId, userId), ilike(categoryGroups.name, "debt")));

    if (!group) {
      [group] = await tx.insert(categoryGroups).values({ userId, name: "DEBT", sortOrder: 99 }).returning();
    }

    const [reserveCategory] = await tx
      .insert(categories)
      .values({
        userId,
        groupId: group.id,
        name: `${input.name} Reserve`,
        categoryType: "spending",
        allocatedBalance: "0",
      })
      .returning();

    await tx.insert(debts).values({
      userId,
      accountId: account.id,
      categoryId: reserveCategory.id,
      startingBalance: input.currentBalance,
    });
  }

  return account;
}

export interface UpdateAccountInput {
  name: string;
  type: AccountTypeValue;
  isCashAccount: boolean;
}

// New: the web app has no account-edit page at all today (confirmed --
// only create + delete exist), so there's no existing action to mirror
// here. Deliberately excludes currentBalance: balances should only ever
// move through recorded transactions (income/expense/transfer/debt
// payment), never a direct field edit, or the transaction history stops
// being a complete audit trail of every dollar's movement and reports
// like "Income This Month" silently drift from the real cash movement.
// name/type/isCashAccount don't move money, so they're safe to edit
// directly.
export function parseUpdateAccountInput(body: unknown): UpdateAccountInput {
  if (!body || typeof body !== "object") {
    throw new ValidationError("A JSON request body is required.");
  }
  const record = body as Record<string, unknown>;
  const name = requireString(record, "name").trim();
  const type = requireString(record, "type");
  if (!ACCOUNT_TYPES.has(type as AccountTypeValue)) {
    throw new ValidationError("Name and a valid account type are required.");
  }
  return {
    name,
    type: type as AccountTypeValue,
    isCashAccount: record.isCashAccount !== false,
  };
}

export async function updateAccount(tx: Tx, userId: string, accountId: string, input: UpdateAccountInput) {
  const [updated] = await tx
    .update(accounts)
    .set({ name: input.name, type: input.type, isCashAccount: input.isCashAccount })
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .returning();

  if (!updated) throw new NotFoundError("Account not found.");
  return updated;
}
