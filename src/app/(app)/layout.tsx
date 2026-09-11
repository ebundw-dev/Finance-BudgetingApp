import { Nav } from "@/components/Nav";
import { SubmitButton } from "@/components/SubmitButton";
import { logout } from "../login/actions";

const signOutButton =
  "text-text-secondary hover:bg-surface-hover hover:text-danger w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Nav
        onSignOut={
          <form action={logout}>
            <SubmitButton className={signOutButton} pendingLabel="Signing out…">
              Sign out
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
