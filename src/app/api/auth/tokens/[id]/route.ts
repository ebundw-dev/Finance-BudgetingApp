import { db } from "@/db";
import { requireApiUser } from "@/lib/api/auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { revokeApiToken } from "@/lib/auth/apiTokens";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const revoked = await db.transaction((tx) => revokeApiToken(tx, auth.userId, id));
  if (!revoked) return apiError("Token not found.", 404);

  return apiSuccess({ id, revoked: true });
}
