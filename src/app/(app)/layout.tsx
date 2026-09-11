import { Nav } from "@/components/Nav";
import { logout } from "../login/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Nav
        onSignOut={
          <form action={logout}>
            <button
              type="submit"
              className="text-text-secondary hover:bg-surface-hover hover:text-danger w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors"
            >
              Sign out
            </button>
          </form>
        }
      />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
