import { db } from "@/db";
import { verifySession } from "@/lib/auth/dal";
import { listApiTokensForUser } from "@/lib/auth/apiTokens";
import { PageHeader } from "@/components/PageHeader";
import { TokenSettings } from "@/components/TokenSettings";
import { Card } from "@/components/Card";
import { buttonSecondary } from "@/lib/ui";

export default async function SettingsPage() {
  const { userId } = await verifySession();
  const tokens = await db.transaction((tx) => listApiTokensForUser(tx, userId));

  return (
    <div>
      <PageHeader
        eyebrow="Devices with access"
        title="Settings."
        subtitle="API tokens let a mobile app sign in as you. Lost the phone? Revoke its token here."
      />
      <TokenSettings tokens={tokens} />

      <Card className="mt-6 max-w-md">
        <h2 className="mb-2 text-sm font-medium tracking-wide text-text-secondary uppercase">Your Data</h2>
        <p className="mb-4 text-sm text-text-muted">
          Download a complete JSON export of everything Ledger has for you -- accounts, categories,
          transactions, goals, debts, rule sets, and scheduled transactions -- for backup or peace of
          mind. No import yet; this is export only.
        </p>
        <a href="/api/export" className={buttonSecondary}>
          Export my data
        </a>
      </Card>
    </div>
  );
}
