"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { phaseEnum, users } from "@/db/schema";
import { verifySession } from "@/lib/auth/dal";

const VALID_PHASES = new Set(phaseEnum.enumValues);

export interface UpdatePhaseState {
  phase: string;
}

// Takes (prevState, formData) and returns the saved phase so PhaseForm can
// drive its remount-key off useActionState's guaranteed post-dispatch state
// update, rather than the timing of the Server Component prop refresh that
// revalidatePath triggers -- see PhaseForm.tsx for why that timing isn't
// reliable enough on its own to beat React 19's post-dispatch form reset.
export async function updatePhase(
  prevState: UpdatePhaseState,
  formData: FormData
): Promise<UpdatePhaseState> {
  const { userId } = await verifySession();
  const phase = String(formData.get("phase") ?? "");

  if (!VALID_PHASES.has(phase as (typeof phaseEnum.enumValues)[number])) {
    return prevState;
  }

  await db
    .update(users)
    .set({ phase: phase as (typeof phaseEnum.enumValues)[number] })
    .where(eq(users.id, userId));

  revalidatePath("/");
  return { phase };
}
