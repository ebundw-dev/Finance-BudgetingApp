import { verifySession } from "@/lib/auth/dal";
import { logout } from "./login/actions";

export default async function Home() {
  await verifySession();

  return (
    <main>
      <h1>Ledger</h1>
      <p>Phase 3: password gate is live. Dashboard comes in a later phase.</p>
      <form action={logout}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
