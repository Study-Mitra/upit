import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Guard every /admin route except the login screen and its API.
 *
 * Runs on the edge runtime, so `jose` is used rather than a Node crypto JWT
 * library, and the session is verified here rather than imported from
 * lib/admin/auth (which uses next/headers cookies()).
 */
const SESSION_COOKIE = 'upit_admin_session';

const PUBLIC_PATHS = ['/admin/login', '/admin/api/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/admin')) return NextResponse.next();
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (token && secret && secret.length >= 32) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
      return NextResponse.next();
    } catch {
      /* expired or tampered — fall through to the redirect */
    }
  }

  const login = request.nextUrl.clone();
  login.pathname = '/admin/login';
  // Preserve where they were heading so login can send them back.
  login.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/admin/:path*'],
};
