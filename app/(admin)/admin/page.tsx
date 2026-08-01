import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import { getCounts } from '@/lib/admin/counts';
import AdminShell from '@/components/admin/AdminShell';

export const metadata = {
  title: 'Dashboard — SRM Education Admin',
  robots: { index: false, follow: false },
};

/** Reads the session cookie and live counts, so never prerendered. */
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Middleware already guards /admin, but a page rendering private data verifies
  // its own session rather than trusting an upstream check.
  const session = await getSession();
  if (!session) redirect('/admin/login?next=%2Fadmin');

  const counts = await getCounts();

  const tiles: { label: string; value: number }[] = [
    { label: 'Colleges', value: counts.colleges },
    { label: 'Courses', value: counts.courses },
    { label: 'Pages', value: counts.pages },
    { label: 'Leads', value: counts.leads },
  ];

  return (
    <AdminShell
      current="dashboard"
      email={session.email}
      counts={counts}
      title="Dashboard"
      subtitle="Manage the public site's content."
    >
      <div className="a-grid">
        {tiles.map((t) => (
          <div className="a-card a-stat" key={t.label}>
            <div className="a-stat-label">{t.label}</div>
            <div className="a-stat-value">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="a-card a-card-pad">
        <p style={{ margin: 0, color: 'var(--a-muted)' }}>
          College management arrives next. Courses, pages and leads follow in later phases,
          so those sidebar links are not live yet.
        </p>
      </div>
    </AdminShell>
  );
}
