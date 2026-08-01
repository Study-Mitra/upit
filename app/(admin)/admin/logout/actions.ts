'use server';

import { redirect } from 'next/navigation';
import { clearSessionCookie } from '@/lib/admin/auth';

/** `redirect()` throws NEXT_REDIRECT, so it stays outside any try/catch. */
export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect('/admin/login');
}
