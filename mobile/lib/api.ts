import type { TargetType } from "./categoryTargets";

export class ApiError extends Error {}

// Shared request helper -- every API route responds with the same
// { data, error } envelope (src/lib/api/response.ts), so every fetch
// function below goes through this. Parses the body before deciding
// whether the request failed, so a 400/404/422 with a real message (e.g.
// "categoryId is required.") surfaces that message instead of a generic
// "HTTP 400".
async function apiRequest<T>(
  baseUrl: string,
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      "Couldn't reach that URL. Check the API Base URL, your network connection, and that the server is running."
    );
  }

  if (response.status === 401) {
    throw new ApiError("That token was rejected. Check it's a valid, unrevoked token.");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (!response.ok) throw new ApiError(`Server responded with HTTP ${response.status}.`);
    throw new ApiError("Server response wasn't valid JSON.");
  }

  const { data, error } = (body ?? {}) as { data?: T; error?: string };
  if (error) throw new ApiError(error);
  if (!response.ok) throw new ApiError(`Server responded with HTTP ${response.status}.`);
  if (data === undefined || data === null) throw new ApiError("Response was missing a data field.");
  return data;
}

// ---- Dashboard (Phase 3) ----------------------------------------------

// Mirrors src/lib/dashboard/queries.ts's DashboardData -- the exact shape
// GET /api/dashboard returns. No shared package between the two apps, so
// this is a hand-kept copy; keep in sync if the API response shape changes.
export interface GoalCategoryProgress {
  id: string;
  name: string;
  allocatedBalance: string;
  targetType: TargetType;
  targetAmount: string;
  targetDate: string | null;
  allocatedThisMonth: string;
}

export interface EarmarkedCategory {
  name: string;
  allocatedBalance: string;
}

export interface DashboardData {
  phase: string;
  totalCash: string;
  unallocatedCash: string;
  totalDebt: string;
  netFinancialPosition: string;
  incomeThisMonth: string;
  spendingThisMonth: string;
  debtPaidThisMonth: string;
  goalProgress: GoalCategoryProgress[];
  earmarked: EarmarkedCategory[];
  dueScheduledCount: number;
  upcomingScheduledCount: number;
  newSubscriptionCount: number;
}

export async function fetchDashboard(baseUrl: string, token: string): Promise<DashboardData> {
  return apiRequest<DashboardData>(baseUrl, token, "/api/dashboard");
}

// ---- Accounts (Phase 4) -----------------------------------------------

// Mirrors the `accounts` Drizzle table (src/db/schema.ts) -- the exact
// row shape GET /api/accounts and GET /api/accounts/[id] return.
export type AccountType = "checking" | "savings" | "cash" | "credit_card" | "investment" | "other";

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  isCashAccount: boolean;
  currentBalance: string;
  isArchived: boolean;
  createdAt: string;
}

export async function fetchAccounts(baseUrl: string, token: string): Promise<Account[]> {
  return apiRequest<Account[]>(baseUrl, token, "/api/accounts");
}

export async function fetchAccount(baseUrl: string, token: string, id: string): Promise<Account> {
  return apiRequest<Account>(baseUrl, token, `/api/accounts/${id}`);
}

// Mirrors src/lib/api/accounts.ts's CreateAccountInput.
export interface CreateAccountInput {
  name: string;
  type: AccountType;
  currentBalance: string;
  isCashAccount: boolean;
  isDebt: boolean;
}

export async function createAccount(baseUrl: string, token: string, input: CreateAccountInput): Promise<Account> {
  return apiRequest<Account>(baseUrl, token, "/api/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

// Mirrors src/lib/api/accounts.ts's UpdateAccountInput -- deliberately
// excludes currentBalance (see that file's comment: balances should only
// move through recorded transactions, never a direct edit).
export interface UpdateAccountInput {
  name: string;
  type: AccountType;
  isCashAccount: boolean;
}

export async function updateAccount(
  baseUrl: string,
  token: string,
  id: string,
  input: UpdateAccountInput
): Promise<Account> {
  return apiRequest<Account>(baseUrl, token, `/api/accounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

// ---- Categories (Phase 4) ----------------------------------------------

// Mirrors src/lib/categories/queries.ts's CategoryGroupWithCategories --
// the exact shape GET /api/categories returns.
export interface Category {
  id: string;
  userId: string;
  groupId: string;
  name: string;
  categoryType: "spending" | "goal";
  priority: "P1" | "P2" | "P3" | "P4" | null;
  targetType: TargetType | null;
  targetAmount: string | null;
  targetCadence: "weekly" | "monthly" | null;
  targetDate: string | null;
  allocatedBalance: string;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
}

export interface CategoryGroup {
  id: string;
  name: string;
  categories: Category[];
}

export async function fetchCategories(baseUrl: string, token: string): Promise<CategoryGroup[]> {
  return apiRequest<CategoryGroup[]>(baseUrl, token, "/api/categories");
}

// ---- Transactions (Phase 4) --------------------------------------------

// Mirrors src/lib/transactions/queries.ts's TransactionRow/
// PaginatedTransactions -- the exact shape GET /api/transactions returns.
// Note this row is denormalized (account/category names, not ids).
export interface TransactionSplitRow {
  categoryId: string;
  categoryName: string;
  amount: string;
}

export type TransactionType =
  | "income"
  | "allocation"
  | "expense"
  | "debt_payment"
  | "transfer"
  | "category_reallocation";

export interface TransactionRow {
  id: string;
  type: TransactionType;
  amount: string;
  date: string;
  source: string | null;
  notes: string | null;
  accountName: string | null;
  relatedAccountName: string | null;
  categoryName: string | null;
  relatedCategoryName: string | null;
  splits: TransactionSplitRow[];
}

export interface PaginatedTransactions {
  rows: TransactionRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface FetchTransactionsParams {
  dateFrom?: string;
  dateTo?: string;
  accountId?: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
}

export async function fetchTransactions(
  baseUrl: string,
  token: string,
  params: FetchTransactionsParams = {}
): Promise<PaginatedTransactions> {
  const query = new URLSearchParams();
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.accountId) query.set("accountId", params.accountId);
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  const qs = query.toString();
  return apiRequest<PaginatedTransactions>(
    baseUrl,
    token,
    `/api/transactions${qs ? `?${qs}` : ""}`
  );
}

// Mirrors src/lib/api/transactions.ts's CreateTransactionInput, "expense"
// variant only -- this phase's create form doesn't do splits yet.
export interface CreateExpenseInput {
  type: "expense";
  accountId: string;
  categoryId: string;
  amount: string;
  date: string;
  source?: string;
  notes?: string;
}

export async function createExpense(
  baseUrl: string,
  token: string,
  input: CreateExpenseInput
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(baseUrl, token, "/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

// ---- Allocation (Phase 5) ----------------------------------------------

// Mirrors GET /api/allocation's response shape (src/app/api/allocation/route.ts):
// the flat (ungrouped) category list from listCategories, plus current
// unallocated cash.
export interface AllocationState {
  unallocatedCash: string;
  categories: Category[];
}

export async function fetchAllocationState(baseUrl: string, token: string): Promise<AllocationState> {
  return apiRequest<AllocationState>(baseUrl, token, "/api/allocation");
}

// Mirrors src/lib/api/allocation.ts's SubmitAllocationInput.
export interface SubmitAllocationItem {
  categoryId: string;
  amount: string;
}

export interface SubmitAllocationInput {
  items: SubmitAllocationItem[];
  date?: string;
  notes?: string;
}

export async function submitAllocation(
  baseUrl: string,
  token: string,
  input: SubmitAllocationInput
): Promise<unknown> {
  return apiRequest(baseUrl, token, "/api/allocation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

// ---- Goals (Phase 5) ----------------------------------------------------

// Mirrors src/lib/goals/queries.ts's GoalRow -- what GET /api/goals returns
// (a list, joined against the linked category for name/allocated balance).
export interface GoalListRow {
  id: string;
  name: string;
  targetAmount: string;
  targetDate: string | null;
  categoryId: string | null;
  categoryName: string | null;
  allocatedBalance: string | null;
}

export async function fetchGoals(baseUrl: string, token: string): Promise<GoalListRow[]> {
  return apiRequest<GoalListRow[]>(baseUrl, token, "/api/goals");
}

// ---- Debts (Phase 5) -----------------------------------------------------

// Mirrors src/lib/debts/queries.ts's DebtRow -- identical shape for both
// GET /api/debts (list) and GET /api/debts/[id] (single), unlike Goals.
export interface DebtRow {
  id: string;
  accountId: string;
  accountName: string;
  accountType: AccountType;
  currentBalance: string;
  startingBalance: string;
  minimumPayment: string | null;
  apr: string | null;
  targetPayoffDate: string | null;
  categoryId: string;
  categoryName: string;
  reservedBalance: string;
}

export async function fetchDebts(baseUrl: string, token: string): Promise<DebtRow[]> {
  return apiRequest<DebtRow[]>(baseUrl, token, "/api/debts");
}

export async function fetchDebt(baseUrl: string, token: string, id: string): Promise<DebtRow> {
  return apiRequest<DebtRow>(baseUrl, token, `/api/debts/${id}`);
}

// ---- Rule Sets (Phase 5) --------------------------------------------------

// Mirrors src/lib/rules/queries.ts's RuleSetRowWithCategory -- what both
// GET /api/rules (list, one entry per rule set) and GET /api/rules/[name]
// (single) return; the list endpoint already returns every rule set's
// full row list, so mobile never needs the single-rule-set fetch.
export interface RuleSetRow {
  id: string;
  categoryId: string;
  categoryName: string;
  percentage: string;
  sortOrder: number;
}

export interface RuleSet {
  name: string;
  rows: RuleSetRow[];
}

export async function fetchRuleSets(baseUrl: string, token: string): Promise<RuleSet[]> {
  return apiRequest<RuleSet[]>(baseUrl, token, "/api/rules");
}

// ---- Scheduled (Phase 5) --------------------------------------------------

// Mirrors src/lib/scheduled/queries.ts's raw scheduledTransactions row --
// what GET /api/scheduled returns (no joined account/category names,
// matching the web Scheduled page which doesn't show them either).
export interface ScheduledTransactionRow {
  id: string;
  userId: string;
  type: TransactionType;
  accountId: string | null;
  relatedAccountId: string | null;
  categoryId: string | null;
  relatedCategoryId: string | null;
  amount: string;
  description: string;
  cadence: "weekly" | "biweekly" | "monthly" | "yearly" | "custom_days";
  intervalDays: number | null;
  nextDueDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface ScheduledState {
  due: ScheduledTransactionRow[];
  upcoming: ScheduledTransactionRow[];
}

export async function fetchScheduled(baseUrl: string, token: string): Promise<ScheduledState> {
  return apiRequest<ScheduledState>(baseUrl, token, "/api/scheduled");
}

export async function confirmScheduled(
  baseUrl: string,
  token: string,
  id: string,
  amount?: string
): Promise<{ id: string; posted: true }> {
  return apiRequest(baseUrl, token, `/api/scheduled/${id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(amount ? { amount } : {}),
  });
}

export async function skipScheduled(
  baseUrl: string,
  token: string,
  id: string
): Promise<{ id: string; skipped: true; nextDueDate: string }> {
  return apiRequest(baseUrl, token, `/api/scheduled/${id}/skip`, { method: "POST" });
}
