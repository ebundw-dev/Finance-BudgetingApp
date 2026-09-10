"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  createSessionToken,
} from "@/lib/auth/session";

// A fixed dummy hash to run verifyPassword against when no user matches the
// submitted email, so a login attempt takes roughly the same time whether
// or not the email exists -- avoids leaking account existence via timing.
const DUMMY_HASH = hashPassword("not-a-real-password");

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const [user] = await db.select().from(users).where(eq(users.email, email));
  const valid = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    redirect("/login?error=1");
  }

  const token = await createSessionToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });

  redirect("/");
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
