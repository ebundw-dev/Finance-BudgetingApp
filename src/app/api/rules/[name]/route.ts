import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { parseUpdateRuleSetInput, updateRuleSet } from "@/lib/api/rules";
import { getRuleSet } from "@/lib/rules/queries";

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { name } = await params;
  const rows = await getRuleSet(auth.userId, decodeURIComponent(name));
  if (rows.length === 0) return apiError("Rule set not found.", 404);

  return apiSuccess({ name, rows });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { name } = await params;
  const ruleName = decodeURIComponent(name);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  try {
    const input = parseUpdateRuleSetInput(body);
    await db.transaction((tx) => updateRuleSet(tx, auth.userId, ruleName, input));
    const rows = await getRuleSet(auth.userId, ruleName);
    return apiSuccess({ name: ruleName, rows });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
