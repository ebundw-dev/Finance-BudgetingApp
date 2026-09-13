import { verifySession } from "@/lib/auth/dal";
import { exportAllUserData } from "@/lib/export/queries";

// Session-cookie auth (verifySession), not the mobile token auth every
// other API route under src/app/api uses -- this is a web-only feature,
// triggered by a plain link/button click from the browser's own logged-in
// session, downloading the response as a file via Content-Disposition.
export async function GET() {
  const { userId } = await verifySession();
  const data = await exportAllUserData(userId);
  const filename = `ledger-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
