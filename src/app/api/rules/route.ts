import { requireApiUser } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";
import { getRuleSet, listRuleSetNames } from "@/lib/rules/queries";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const names = await listRuleSetNames(auth.userId);
  const ruleSets = await Promise.all(
    names.map(async (name) => ({ name, rows: await getRuleSet(auth.userId, name) }))
  );

  return apiSuccess(ruleSets);
}
