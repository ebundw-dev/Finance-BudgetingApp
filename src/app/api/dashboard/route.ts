import { requireApiUser } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { getDashboardData } from "@/lib/dashboard/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const data = await getDashboardData(auth.userId);
  return apiSuccess(data);
}
