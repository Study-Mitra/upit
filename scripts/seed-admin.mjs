/**
 * Create the single admin account and the session secret.
 *
 * The password is GENERATED and printed exactly once — it is stored only as a
 * bcrypt hash, so it cannot be recovered later. Re-running with --reset issues a
 * new password for the existing account.
 *
 * Usage:
 *   node scripts/seed-admin.mjs
 *   node scripts/seed-admin.mjs --reset
 *   node scripts/seed-admin.mjs --email you@example.com
 */
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { MONGODB_URI as URI, MONGODB_DB as DB } from '../lib/env.mjs';

const ENV_FILE = new URL('../.env.local', import.meta.url);

/** Readable but strong: 24 chars from a no-ambiguous-characters alphabet. */
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(24);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

async function ensureSessionSecret() {
  let env = '';
  try {
    env = await readFile(ENV_FILE, 'utf8');
  } catch {
    /* first run */
  }
  if (/^ADMIN_SESSION_SECRET=.{32,}$/m.test(env)) return false;

  const secret = randomBytes(48).toString('base64url');
  const next =
    env.replace(/^ADMIN_SESSION_SECRET=.*$/m, '').trimEnd() +
    (env.trim() ? '\n' : '') +
    `ADMIN_SESSION_SECRET=${secret}\n`;
  await writeFile(ENV_FILE, next, 'utf8');
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const emailArg = args[args.indexOf('--email') + 1];
  const email =
    args.includes('--email') && emailArg ? emailArg : 'admin@upitcollege.com';

  const wroteSecret = await ensureSessionSecret();

  const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 5000 }).connect();
  const users = client.db(DB).collection('adminUsers');
  await users.createIndex({ email: 1 }, { unique: true });

  const existing = await users.findOne({ email });
  if (existing && !reset) {
    console.log(`\nAdmin account already exists: ${email}`);
    console.log('Password unchanged. To issue a new one:');
    console.log('  node scripts/seed-admin.mjs --reset\n');
    await client.close();
    return;
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  await users.updateOne(
    { email },
    {
      $set: { email, passwordHash, updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  await client.close();

  console.log('\n' + '='.repeat(62));
  console.log('  ADMIN ACCOUNT ' + (existing ? 'PASSWORD RESET' : 'CREATED'));
  console.log('='.repeat(62));
  console.log(`  URL:       http://localhost:3000/admin`);
  console.log(`  Email:     ${email}`);
  console.log(`  Password:  ${password}`);
  console.log('='.repeat(62));
  console.log('  This password is shown ONCE and stored only as a bcrypt hash.');
  console.log('  Save it now.');
  if (wroteSecret) console.log('  ADMIN_SESSION_SECRET written to .env.local');
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
