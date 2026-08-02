import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import LoginForm from './LoginForm';

export const metadata = {
  title: 'Sign in — UPIT College of Education Admin',
  robots: { index: false, follow: false },
};

/** Reads the session cookie, so never prerendered. */
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = '' } = await searchParams;

  // Already signed in — no reason to show the form.
  const session = await getSession();
  if (session) redirect('/admin');

  return (
    <div className="a-login">
      <div className="a-card">
        <h1>UPIT College of Education</h1>
        <p className="sub">Sign in to manage colleges, courses and leads.</p>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
