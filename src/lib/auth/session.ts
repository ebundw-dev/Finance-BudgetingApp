// HMAC-signed, stateless session token -- no sessions table needed for a
// single-user app. Uses the Web Crypto API (globalThis.crypto.subtle)
// rather than node:crypto so this file works unchanged whether middleware
// runs on the Edge or Node.js runtime.

export const SESSION_COOKIE_NAME = "ledger_session";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface SessionPayload {
  userId: string;
  expiresAt: number;
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of buf) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set.");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(userId: string): Promise<string> {
  const payload: SessionPayload = {
    userId,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const key = await getKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload)
  );
  return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<{ userId: string } | null> {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const key = await getKey();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signature) as BufferSource,
    new TextEncoder().encode(encodedPayload)
  );
  if (!valid) return null;

  try {
    const payload: SessionPayload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encodedPayload))
    );
    if (typeof payload.userId !== "string" || typeof payload.expiresAt !== "number") {
      return null;
    }
    if (Date.now() > payload.expiresAt) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
