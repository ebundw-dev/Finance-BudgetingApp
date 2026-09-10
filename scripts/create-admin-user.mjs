// One-time (or re-run to change the password) setup script for the single
// user this app is built for. Reads ADMIN_EMAIL / ADMIN_PASSWORD from .env
// rather than a CLI arg or prompt, so the password never appears in shell
// history or this session's transcript.
//
// This duplicates the scrypt hashing scheme in src/lib/auth/password.ts
// (same salt:hash format) rather than importing it, since that file uses
// TS path aliases a plain Node script can't resolve without a bundler --
// keep the two in sync if that file's hashing scheme ever changes.
import "dotenv/config";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const KEY_LENGTH = 64;

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running this script."
  );
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
const passwordHash = `${salt}:${hash}`;

const sql = neon(process.env.DATABASE_URL);

const existing = await sql`select id from users where email = ${email}`;

if (existing.length > 0) {
  await sql`update users set password_hash = ${passwordHash} where email = ${email}`;
  console.log(`Updated password for existing user ${email}.`);
} else {
  await sql`
    insert into users (id, email, password_hash)
    values (${randomUUID()}, ${email}, ${passwordHash})
  `;
  console.log(`Created user ${email}.`);
}
