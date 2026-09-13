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
