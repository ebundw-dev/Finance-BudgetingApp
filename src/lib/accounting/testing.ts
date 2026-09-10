import { randomUUID } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";
import { accounts, categories, categoryGroups, debts, users } from "@/db/schema";

// A pool dedicated to the test suite. Every test acquires its own client
// (its own real Postgres connection/session) so BEGIN/ROLLBACK on one test
// can never interleave with another.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// NeonDatabase<schema>, not the drizzle(client, {schema}) return type
// directly -- that return type also carries a `$client` field typed to
// whatever client class was passed in (here, PoolClient), and we don't want
// engine.ts's Tx type (typed against a plain NeonDatabase) to reject it
// over that unrelated property.
export type TestTx = NeonDatabase<typeof schema>;

// Runs `fn` inside a real, uncommitted Postgres transaction and always rolls
// it back afterward -- so the engine (and the DB triggers/constraints behind
// it) run exactly as they would in production, but the database is left
// untouched regardless of whether the test passes, fails, or intentionally
// provokes a constraint violation.
export async function withRollback<T>(
  fn: (tx: TestTx) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  const tx = drizzle(client, { schema });
  try {
    await client.query("BEGIN");
    return await fn(tx);
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The transaction may already be in a terminal/aborted state after a
      // test that intentionally provoked a DB-level constraint violation.
      // ROLLBACK is always valid there; if it still throws, the connection
      // is unusable and gets discarded below anyway.
    }
    client.release();
  }
}

export async function closeTestPool(): Promise<void> {
  await pool.end();
}

// Drizzle wraps the underlying Postgres error (which carries the CHECK
// constraint name / RAISE EXCEPTION message we actually want to assert on)
// as `.cause` on its own generic "Failed query" error. Unwraps that so
// tests can assert on the real database-level message.
export async function expectDbError(
  promise: Promise<unknown>,
  pattern: RegExp
): Promise<void> {
  let error: unknown;
  try {
    await promise;
  } catch (err) {
    error = err;
  }
  if (error === undefined) {
    throw new Error(
      `Expected the operation to reject with an error matching ${pattern}, but it resolved.`
    );
  }
  const cause = (error as { cause?: unknown }).cause;
  const message = String(
    (cause as { message?: string })?.message ?? (error as Error).message ?? error
  );
  if (!pattern.test(message)) {
    throw new Error(
      `Expected error message to match ${pattern}, got: ${message}`
    );
  }
}

export async function createTestUser(tx: TestTx) {
  const [user] = await tx
    .insert(users)
    .values({
      email: `test-${randomUUID()}@example.com`,
      passwordHash: "not-a-real-hash",
    })
    .returning();
  return user;
}

export async function createTestAccount(
  tx: TestTx,
  userId: string,
  overrides: Partial<typeof accounts.$inferInsert> = {}
) {
  const [account] = await tx
    .insert(accounts)
    .values({
      userId,
      name: "Test Account",
      type: "checking",
      isCashAccount: true,
      currentBalance: "0",
      ...overrides,
    })
    .returning();
  return account;
}

export async function createTestCategory(
  tx: TestTx,
  userId: string,
  overrides: Partial<typeof categories.$inferInsert> = {}
) {
  const [group] = await tx
    .insert(categoryGroups)
    .values({ userId, name: "Test Group" })
    .returning();
  const [category] = await tx
    .insert(categories)
    .values({
      userId,
      groupId: group.id,
      name: "Test Category",
      categoryType: "spending",
      allocatedBalance: "0",
      ...overrides,
    })
    .returning();
  return category;
}

export async function createTestDebt(
  tx: TestTx,
  userId: string,
  accountId: string,
  overrides: Partial<typeof debts.$inferInsert> & { reserveBalance?: string } = {}
) {
  const { reserveBalance, ...debtOverrides } = overrides;
  const categoryId =
    debtOverrides.categoryId ??
    (
      await createTestCategory(tx, userId, {
        name: "Debt Reserve",
        allocatedBalance: reserveBalance ?? "0",
      })
    ).id;

  const [debt] = await tx
    .insert(debts)
    .values({
      userId,
      accountId,
      startingBalance: "0",
      ...debtOverrides,
      categoryId,
    })
    .returning();
  return debt;
}

// Total Cash (sum of is_cash_account accounts) minus Sum(categories.allocated_balance).
// Used by tests to assert the core equation holds exactly to the cent.
export async function getUnallocatedCash(
  tx: TestTx,
  userId: string
): Promise<string> {
  const userAccounts = await tx
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));
  const userCategories = await tx
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));

  const totalCash = userAccounts
    .filter((a) => a.isCashAccount)
    .reduce((sum, a) => sum + Number(a.currentBalance), 0);
  const totalAllocated = userCategories.reduce(
    (sum, c) => sum + Number(c.allocatedBalance),
    0
  );

  return (totalCash - totalAllocated).toFixed(2);
}
