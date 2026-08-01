import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

/**
 * Admin session handling.
 *
 * A signed, httpOnly JWT in a cookie. `jose` is used rather than a Node-only
 * JWT library because middleware runs on the edge runtime, where Node crypto is
 * unavailable.
 */

export const SESSION_COOKIE = 'srm_admin_session';
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function secretKey(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'ADMIN_SESSION_SECRET is missing or too short (needs >= 32 chars). ' +
        'Run: node scripts/seed-admin.mjs'
    );
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = { email: string };

export async function createSessionToken(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.email !== 'string') return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Read the current admin session, or null when signed out. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
