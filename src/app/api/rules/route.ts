import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api/response";
import { createRuleSet, parseCreateRuleSetInput } from "@/lib/api/rules";
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

// Mirrors src/lib/rules/actions.ts's createRuleSet Server Action exactly
// (see src/lib/api/rules.ts) -- no parallel validation.
export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  try {
    const input = parseCreateRuleSetInput(body);
    await db.transaction((tx) => createRuleSet(tx, auth.userId, input));
    const rows = await getRuleSet(auth.userId, input.ruleName);
    return apiSuccess({ name: input.ruleName, rows }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
