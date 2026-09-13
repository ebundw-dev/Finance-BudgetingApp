import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// --- Enums ---

export const phaseEnum = pgEnum("phase", [
  "STABILIZE",
  "BUILD",
  "EXPAND",
  "FREEDOM",
]);

export const accountTypeEnum = pgEnum("account_type", [
  "checking",
  "savings",
  "cash",
  "credit_card",
  "investment",
  "other",
]);

export const categoryTypeEnum = pgEnum("category_type", ["spending", "goal"]);

// How a category's target_amount should be interpreted -- see the
// categories table comment below for the behavior of each.
export const targetTypeEnum = pgEnum("target_type", [
  "refill_up_to",
  "set_aside_monthly",
  "by_date",
]);

// Only meaningful for targetType "refill_up_to" -- how often the user
// intends to top the category back up. Doesn't change the funded
// computation (balance vs. target_amount either way); it's a label for
// display ("Refill up to $150 / week" vs "/ month").
export const targetCadenceEnum = pgEnum("target_cadence", ["weekly", "monthly"]);

export const priorityEnum = pgEnum("priority", ["P1", "P2", "P3", "P4"]);

// Covers all 7 accounting rules from CLAUDE.md. "expense" branches into
// cash-account vs credit-card behavior based on the account it references,
// rather than being split into two transaction types.
export const transactionTypeEnum = pgEnum("transaction_type", [
  "income",
  "allocation",
  "expense",
  "debt_payment",
  "transfer",
  "category_reallocation",
  // Phase 11: corrects drift between Ledger's computed cash-account
  // balance and a real bank-statement balance. Touches only the account's
  // currentBalance (no category effect), so Unallocated Cash absorbs the
  // whole delta -- economically a signed, categoryless income/expense.
  // See recordReconciliation in src/lib/accounting/engine.ts.
  "reconciliation",
]);

export const scheduledCadenceEnum = pgEnum("scheduled_cadence", [
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
  "custom_days",
]);

// --- Tables ---

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phase: phaseEnum("phase").notNull().default("STABILIZE"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// A long random string issued to a client (e.g. a mobile app) in place of
// the session cookie -- see src/lib/auth/apiTokens.ts. tokenHash is a
// plain SHA-256 digest of the raw token, not scrypt/hashPassword's salted
// scheme: the raw token is already 256 bits of random entropy (no
// dictionary/rainbow-table risk the way a human password has), and a
// salted hash can't be looked up by value in the first place -- only
// reproduced given the same salt, which defeats an indexed lookup. The
// raw token itself is shown to the caller exactly once, at issue time,
// and never stored.
export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull(),
  isCashAccount: boolean("is_cash_account").notNull().default(true),
  currentBalance: numeric("current_balance", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  isArchived: boolean("is_archived").notNull().default(false),
  // Phase 11 reconciliation: null until the account has been reconciled
  // at least once. lastReconciledBalance is the statement balance entered
  // at that time (not necessarily equal to currentBalance today, since
  // more transactions may have posted since) -- purely informational,
  // shown on the account's Reconcile screen as "last reconciled".
  lastReconciledAt: timestamp("last_reconciled_at", { withTimezone: true }),
  lastReconciledBalance: numeric("last_reconciled_balance", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categoryGroups = pgTable("category_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    groupId: uuid("group_id")
      .notNull()
      .references(() => categoryGroups.id),
    name: text("name").notNull(),
    categoryType: categoryTypeEnum("category_type")
      .notNull()
      .default("spending"),
    priority: priorityEnum("priority"),
    // Three ways a target_amount can be interpreted (see CLAUDE.md-adjacent
    // notes on targets, and src/lib/categories/targets.ts for the actual
    // funded-status computation):
    //   refill_up_to      -> funded once allocated_balance reaches
    //                         target_amount; spending back down just means
    //                         it needs refilling again. targetCadence is a
    //                         display-only label for how often ("weekly"/
    //                         "monthly"), not part of the computation.
    //   set_aside_monthly -> a fixed target_amount must be allocated every
    //                         calendar month, regardless of leftover
    //                         balance -- no cap, no cadence field (it's
    //                         always monthly), no target date.
    //   by_date           -> target_amount is a total to reach by
    //                         targetDate; the monthly amount needed is
    //                         computed dynamically as
    //                         (target_amount - allocated_balance) / months
    //                         remaining, never stored.
    // Null targetType means no target is set at all (targetAmount is also
    // null in that case). A category with a pre-existing targetAmount and
    // no targetType is backfilled to "refill_up_to" by the migration that
    // introduced these columns, so existing targets keep working.
    targetType: targetTypeEnum("target_type"),
    targetAmount: numeric("target_amount", { precision: 12, scale: 2 }),
    targetCadence: targetCadenceEnum("target_cadence"),
    targetDate: date("target_date"),
    allocatedBalance: numeric("allocated_balance", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "allocated_balance_non_negative",
      sql`${table.allocatedBalance} >= 0`
    ),
  ]
);

// Remembers which category a payee was last charged against, so expense
// entry can suggest it instead of the user re-picking the same category
// every time. name is stored already normalized (trim + lowercase +
// collapsed whitespace, via normalizePayee in subscriptions/detect.ts) so
// "Netflix" and "  NETFLIX  " dedupe to one row instead of two -- unique
// per user. Purely a data-entry convenience: never read by the accounting
// engine, and deleting/renaming a payee has no effect on past transactions
// beyond the now-dangling (nullable) transactions.payee_id FK.
export const payees = pgTable(
  "payees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    lastCategoryId: uuid("last_category_id").references(() => categories.id),
    useCount: integer("use_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("payees_user_name_unique").on(table.userId, table.name)]
);

// Unified ledger feed. Column usage per type (see CLAUDE.md's rules table):
//   income                 -> accountId = destination cash account
//   allocation              -> categoryId = destination category (source is Unallocated Cash, not a row)
//   expense (cash account)  -> accountId = cash account, categoryId = spent category
//   expense (credit card)   -> accountId = credit card account, categoryId = spent category,
//                              relatedCategoryId = that card's debt reserve category (debts.category_id),
//                              credited by the same amount so Sum(categories) doesn't move
//   debt_payment             -> accountId = source cash account, relatedAccountId = debt/CC account paid down,
//                              categoryId = that debt's reserve category, debited by the payment amount
//   transfer                 -> accountId = from account, relatedAccountId = to account
//   category_reallocation    -> categoryId = from category, relatedCategoryId = to category
// amount is always stored positive; direction is derived from `type` in the accounting engine.
//
// Split expenses: only "expense" rows can be split (one card swipe/receipt
// across multiple categories). A split expense keeps categoryId null on the
// parent row -- null here means "look at transaction_splits for the
// per-category breakdown" instead of "spent category". relatedCategoryId
// still carries the credit-card debt reserve category when applicable,
// since every split of one transaction shares the same account and
// therefore the same reserve category. See transactionSplits below and
// recordSplitExpense/updateSplitExpense in accounting/engine.ts.
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: transactionTypeEnum("type").notNull(),
    accountId: uuid("account_id").references(() => accounts.id),
    relatedAccountId: uuid("related_account_id").references(
      () => accounts.id
    ),
    categoryId: uuid("category_id").references(() => categories.id),
    relatedCategoryId: uuid("related_category_id").references(
      () => categories.id
    ),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    // Only set (and only meaningful) for type "reconciliation" -- the
    // signed statementBalance-minus-currentBalance delta at post time.
    // `amount` above stays the always-positive abs(delta), matching the
    // "amount is always stored positive" rule every other type follows;
    // this is the one place direction can't be inferred from `type`
    // alone (a reconciliation can go either way), so it gets its own
    // column instead of loosening amount's CHECK constraint.
    reconciliationDelta: numeric("reconciliation_delta", { precision: 12, scale: 2 }),
    date: date("date").notNull(),
    source: text("source"),
    notes: text("notes"),
    // Set only on expense entries made through the payee combobox (see
    // src/lib/payees) -- additive to source, not a replacement for it.
    payeeId: uuid("payee_id").references(() => payees.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [check("amount_positive", sql`${table.amount} > 0`)]
);

// Per-category breakdown for a split expense (see the comment on
// transactions above). The sum of a transaction's splits must equal its
// parent transactions.amount exactly -- enforced in the accounting engine
// (recordSplitExpense/updateSplitExpense), not a DB constraint, since a
// CHECK can't aggregate across rows.
export const transactionSplits = pgTable(
  "transaction_splits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [check("transaction_split_amount_positive", sql`${table.amount} > 0`)]
);

// A template for a future transactions row -- "Embrace Your True
// Expenses": bills and irregular expenses get budgeted for before they
// hit, instead of surprising Unallocated Cash the day they're due. Column
// usage mirrors the transactions table exactly (same type-to-column
// mapping, see the comment above it), since confirming a due scheduled
// transaction is just calling the same accounting engine function
// (recordIncome, recordExpense, recordAllocation, recordDebtPayment,
// recordTransfer, recordCategoryReallocation) with these stored values --
// see src/lib/scheduled/actions.ts. Never posts on its own: due ones are
// only ever surfaced for a one-tap confirm (or skip, or amount edit) on
// the Scheduled page; nothing here writes to transactions/categories/
// accounts directly.
export const scheduledTransactions = pgTable(
  "scheduled_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: transactionTypeEnum("type").notNull(),
    accountId: uuid("account_id").references(() => accounts.id),
    relatedAccountId: uuid("related_account_id").references(() => accounts.id),
    categoryId: uuid("category_id").references(() => categories.id),
    relatedCategoryId: uuid("related_category_id").references(() => categories.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    // Payee/description -- what shows in the Scheduled list, and what gets
    // passed through as the resulting transaction's source (income/expense)
    // or notes (everything else) when confirmed.
    description: text("description").notNull(),
    cadence: scheduledCadenceEnum("cadence").notNull(),
    // Only meaningful (and required) for cadence "custom_days".
    intervalDays: integer("interval_days"),
    nextDueDate: date("next_due_date").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [check("scheduled_amount_positive", sql`${table.amount} > 0`)]
);

// One row per subscription-candidate signature (account + category + fuzzy
// payee) the user has dismissed from /subscriptions -- keyed the same way
// detectRecurringCandidates excludes an already-scheduled group, so a
// dismissal sticks across page loads instead of being re-suggested every
// time (detection runs live on each visit; see src/lib/subscriptions).
export const dismissedSubscriptionCandidates = pgTable(
  "dismissed_subscription_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    payeeKey: text("payee_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("dismissed_subscription_candidates_signature_unique").on(
      table.userId,
      table.accountId,
      table.categoryId,
      table.payeeKey
    ),
  ]
);

export const debts = pgTable("debts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  accountId: uuid("account_id")
    .notNull()
    .unique()
    .references(() => accounts.id),
  // The category (e.g. "Credit Card 1" in the DEBT group) that reserves
  // cash to pay this debt down. A credit card purchase moves the spent
  // amount from the user's chosen spending category into this one, so the
  // sum of all category balances -- and therefore Unallocated Cash -- never
  // moves at purchase time. Paying the bill later draws down this category
  // (and cash) without touching the spending category again, since the
  // spend was already counted at purchase time. See CLAUDE.md.
  categoryId: uuid("category_id")
    .notNull()
    .unique()
    .references(() => categories.id),
  startingBalance: numeric("starting_balance", { precision: 12, scale: 2 }).notNull(),
  minimumPayment: numeric("minimum_payment", { precision: 12, scale: 2 }),
  apr: numeric("apr", { precision: 5, scale: 2 }),
  targetPayoffDate: date("target_payoff_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  categoryId: uuid("category_id").references(() => categories.id),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  targetDate: date("target_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const allocationRules = pgTable("allocation_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  ruleName: text("rule_name").notNull(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const months = pgTable(
  "months",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    unallocatedCashSnapshot: numeric("unallocated_cash_snapshot", {
      precision: 12,
      scale: 2,
    }).notNull(),
    totalCashSnapshot: numeric("total_cash_snapshot", {
      precision: 12,
      scale: 2,
    }).notNull(),
    totalDebtSnapshot: numeric("total_debt_snapshot", {
      precision: 12,
      scale: 2,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("months_user_year_month_unique").on(
      table.userId,
      table.year,
      table.month
    ),
    check("month_valid_range", sql`${table.month} >= 1 AND ${table.month} <= 12`),
  ]
);

// Per-goal-category balance at the time a month was snapshotted. Not
// hardcoded to specific categories (e.g. "Car Fund") -- one row per
// goal-type category that existed at snapshot time, so the progress page
// can chart whichever goal categories the user actually has.
export const monthCategorySnapshots = pgTable(
  "month_category_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    monthId: uuid("month_id")
      .notNull()
      .references(() => months.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    allocatedBalance: numeric("allocated_balance", {
      precision: 12,
      scale: 2,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("month_category_snapshots_month_category_unique").on(
      table.monthId,
      table.categoryId
    ),
  ]
);
