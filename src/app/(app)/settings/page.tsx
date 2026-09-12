import { db } from "@/db";
import { verifySession } from "@/lib/auth/dal";
import { listApiTokensForUser } from "@/lib/auth/apiTokens";
import { PageHeader } from "@/components/PageHeader";
import { TokenSettings } from "@/components/TokenSettings";

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
    </div>
  );
}
