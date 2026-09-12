"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { verifySession } from "./dal";
import { issueApiToken, revokeApiToken, type IssuedApiToken } from "./apiTokens";

// Deliberately does NOT redirect, unlike every other action in this app --
// the raw token must be shown to the caller exactly once, right after
// creation, and a redirect would mean passing that secret through a URL
// query string to get it there. useActionState (see TokenSettings.tsx)
// lets the created token flow back into client state directly instead,
// the same reason src/lib/import/actions.ts's preview/import actions
// avoid redirecting.
export async function createApiTokenAction(
  _prevState: IssuedApiToken | null,
  formData: FormData
): Promise<IssuedApiToken> {
  const { userId } = await verifySession();
  const name = String(formData.get("name") ?? "").trim() || "API token";
  return db.transaction((tx) => issueApiToken(tx, userId, name));
}

export async function revokeApiTokenAction(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const tokenId = String(formData.get("tokenId") ?? "");

  await db.transaction((tx) => revokeApiToken(tx, userId, tokenId));

  redirect("/settings");
}
