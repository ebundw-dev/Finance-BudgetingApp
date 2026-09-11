"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { phaseEnum, users } from "@/db/schema";
import { verifySession } from "@/lib/auth/dal";

const VALID_PHASES = new Set(phaseEnum.enumValues);

export async function updatePhase(formData: FormData): Promise<void> {
  const { userId } = await verifySession();
  const phase = String(formData.get("phase") ?? "");

  if (!VALID_PHASES.has(phase as (typeof phaseEnum.enumValues)[number])) {
    return;
  }

  await db
    .update(users)
    .set({ phase: phase as (typeof phaseEnum.enumValues)[number] })
    .where(eq(users.id, userId));

  revalidatePath("/");
}
