import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { getSpendingForMonth, parseSpendingReportParams } from "@/lib/api/reports";

// Mirrors src/app/(app)/reports/spending/page.tsx's data (year/month
// query params, defaulting to the current month) -- see
// src/lib/api/reports.ts's comment for why the query itself is a
// separate copy of getCategorySpendingForMonth rather than importing it.
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);

  try {
    const params = parseSpendingReportParams(url.searchParams);
    const rows = await getSpendingForMonth(db, auth.userId, params);
    return apiSuccess(rows);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
