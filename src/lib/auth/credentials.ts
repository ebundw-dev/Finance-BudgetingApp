import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "./password";

// A fixed dummy hash to run verifyPassword against when no user matches the
// submitted email, so a login attempt takes roughly the same time whether
// or not the email exists -- avoids leaking account existence via timing.
// Shared by the web login form and the API token-issue endpoint, which is
// exactly the same check ("does this email/password pair belong to a real
// user") for two different callers.
const DUMMY_HASH = hashPassword("not-a-real-password");

export async function verifyCredentials(
  email: string,
  password: string
): Promise<{ id: string } | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));
  const valid = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  return user && valid ? { id: user.id } : null;
}
