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
    targetAmount: numeric("target_amount", { precision: 12, scale: 2 }),
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
