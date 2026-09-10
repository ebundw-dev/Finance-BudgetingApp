import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main>
      <h1>Ledger</h1>
      <form action={login}>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <button type="submit">Sign in</button>
      </form>
      {error ? <p role="alert">Invalid email or password.</p> : null}
    </main>
  );
}
