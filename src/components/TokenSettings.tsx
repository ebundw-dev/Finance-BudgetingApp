"use client";

import { useActionState } from "react";
import { createApiTokenAction, revokeApiTokenAction } from "@/lib/auth/tokenActions";
import type { ApiTokenSummary, IssuedApiToken } from "@/lib/auth/apiTokens";
import { SubmitButton } from "@/components/SubmitButton";
import { Card } from "@/components/Card";
import {
  buttonDanger,
  buttonPrimary,
  field,
  input as inputClass,
  label as labelClass,
  table,
  td,
  th,
} from "@/lib/ui";

export function TokenSettings({ tokens }: { tokens: ApiTokenSummary[] }) {
  const [issued, formAction] = useActionState<IssuedApiToken | null, FormData>(createApiTokenAction, null);

  return (
    <div>
      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-medium tracking-wide text-text-secondary uppercase">
          Create a new token
        </h2>
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <div className={`${field} mb-0 min-w-[180px] flex-1`}>
            <label htmlFor="name" className={labelClass}>
              Name
            </label>
            <input id="name" name="name" type="text" placeholder="e.g. iPhone" className={inputClass} />
          </div>
          <SubmitButton className={buttonPrimary} pendingLabel="Creating…">
            Create token
          </SubmitButton>
        </form>

        {issued ? (
          <div className="border-warning/30 bg-warning/10 mt-4 rounded-md border p-4">
            <p className="mb-2 text-sm font-medium text-text">
              Copy this token now — it won&apos;t be shown again.
            </p>
            <code className="bg-base block break-all rounded px-3 py-2 text-xs text-text">
              {issued.token}
            </code>
          </div>
        ) : null}
      </Card>

      {tokens.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">No tokens yet.</p>
        </Card>
      ) : (
        <Card padded={false} className="overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Created</th>
                <th className={th}>Last used</th>
                <th className={th}>Status</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id} className="hover:bg-surface-hover/60 transition-colors">
                  <td className={td}>{token.name}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {new Date(token.createdAt).toLocaleDateString()}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleDateString() : "Never"}
                  </td>
                  <td className={td}>
                    {token.revokedAt ? (
                      <span className="bg-text-secondary/10 text-text-secondary rounded-full px-2 py-0.5 text-xs font-medium">
                        Revoked
                      </span>
                    ) : (
                      <span className="bg-success/12 text-success rounded-full px-2 py-0.5 text-xs font-medium">
                        Active
                      </span>
                    )}
                  </td>
                  <td className={td}>
                    {!token.revokedAt ? (
                      <form action={revokeApiTokenAction}>
                        <input type="hidden" name="tokenId" value={token.id} />
                        <SubmitButton className={`${buttonDanger} px-3 py-1 text-xs`} pendingLabel="Revoking…">
                          Revoke
                        </SubmitButton>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
