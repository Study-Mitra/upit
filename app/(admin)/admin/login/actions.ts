'use server';

import { redirect } from 'next/navigation';
import { verifyCredentials } from '@/lib/admin/login';
import { createSessionToken, setSessionCookie } from '@/lib/admin/auth';

export type LoginState = { error: string | null };

/**
 * Sign in.
 *
 * A Server Action rather than a route handler: it POSTs to the page's own URL,
 * which PUBLIC_PATHS in middleware.ts already exempts, so no separate
 * /admin/api/login endpoint is needed.
 *
 * `redirect()` throws NEXT_REDIRECT, so it is called after all awaited work and
 * never inside a try/catch — otherwise the redirect is swallowed and the user
 * sits on the login page while holding a valid session.
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');

  if (!email || !password) return { error: 'Invalid email or password.' };

  const ok = await verifyCredentials(email, password);
  // Deliberately identical for an unknown email and a wrong password.
  if (!ok) return { error: 'Invalid email or password.' };

  await setSessionCookie(await createSessionToken(email.trim().toLowerCase()));

  // Only internal admin destinations, so ?next= cannot become an open redirect.
  const destination =
    next.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin';
  redirect(destination);
}
