import { getDb } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

/**
 * Verify an admin's email and password.
 *
 * Returns a plain boolean rather than the user document: callers only need the
 * yes/no, and not returning the record keeps the bcrypt hash out of wider scope.
 *
 * Email is lower-cased before lookup because `seed-admin.mjs` stores whatever was
 * typed on the command line and operators are inconsistent about case. A bcrypt
 * comparison runs against a dummy hash when the account is missing, so a wrong
 * email and a wrong password take indistinguishable time.
 */

/** bcrypt hash of a value nobody can supply; keeps failure timing uniform. */
const DUMMY_HASH = '$2b$12$eImiTXuWVxfM37uY4JANjQ.Xa2HdrLAeC5cFCDqXK7Fz1I8N9Q4Ry';

type AdminUser = { email: string; passwordHash: string };

export async function verifyCredentials(email: string, password: string): Promise<boolean> {
  const normalised = email.trim().toLowerCase();
  if (!normalised || !password) return false;

  const db = await getDb();
  const user = await db
    .collection<AdminUser>('adminUsers')
    .findOne({ email: normalised }, { projection: { _id: 0, passwordHash: 1 } });

  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  return Boolean(user) && ok;
}
