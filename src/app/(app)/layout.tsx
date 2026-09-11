import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifySession } from "@/lib/auth/dal";
import { Nav } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { logout } from "../login/actions";

const signOutButton =
  "text-text-secondary hover:text-danger flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface-hover";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await verifySession();
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Nav
        userEmail={user?.email ?? ""}
        onSignOut={
          <form action={logout}>
            <SubmitButton className={signOutButton} pendingLabel="…" title="Sign out">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </SubmitButton>
          </form>
        }
      />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
