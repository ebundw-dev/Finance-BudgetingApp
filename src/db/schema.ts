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
    date: date("date").notNull(),
    source: text("source"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [check("amount_positive", sql`${table.amount} > 0`)]
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
