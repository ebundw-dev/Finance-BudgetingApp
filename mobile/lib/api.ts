import type { TargetType } from "./categoryTargets";

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

export class ApiError extends Error {}

export async function fetchDashboard(baseUrl: string, token: string): Promise<DashboardData> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/dashboard`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError(
      "Couldn't reach that URL. Check the API Base URL, your network connection, and that the server is running."
    );
  }

  if (response.status === 401) {
    throw new ApiError("That token was rejected. Check it's a valid, unrevoked token.");
  }
  if (!response.ok) {
    throw new ApiError(`Server responded with HTTP ${response.status}.`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError("Server response wasn't valid JSON.");
  }

  const { data, error } = body as { data?: DashboardData; error?: string };
  if (error) throw new ApiError(error);
  if (!data) throw new ApiError("Response was missing a data field.");
  return data;
}
