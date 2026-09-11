import { SubmitButton } from "@/components/SubmitButton";
import { buttonPrimary, errorBanner, field, input, label as labelClass } from "@/lib/ui";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-text">Ledger</h1>
        <form action={login}>
          <div className={field}>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              className={input}
            />
          </div>
          <div className={field}>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={input}
            />
          </div>
          {error ? (
            <p role="alert" className={errorBanner}>
              Invalid email or password.
            </p>
          ) : null}
          <SubmitButton className={`${buttonPrimary} w-full`} pendingLabel="Signing in…">
            Sign in
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
