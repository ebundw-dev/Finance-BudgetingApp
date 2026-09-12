import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRuleSet } from "@/lib/rules/queries";

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { name } = await params;
  const rows = await getRuleSet(auth.userId, decodeURIComponent(name));
  if (rows.length === 0) return apiError("Rule set not found.", 404);

  return apiSuccess({ name, rows });
}
