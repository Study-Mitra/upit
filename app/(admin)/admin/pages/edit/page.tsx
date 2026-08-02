import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import { getCounts } from '@/lib/admin/counts';
import { getPage } from '@/lib/models/pages';
import AdminShell from '@/components/admin/AdminShell';
import PageForm from '../PageForm';

export const metadata = {
  title: 'Edit page — UPIT College of Education Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Keyed by a `?path=` query rather than a catch-all route segment: page paths
 * contain slashes (/specialization-details/online-distance-mba-in-general), and a
 * catch-all would collide with the admin's own routing.
 */
export default async function EditPageRoute({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; saved?: string }>;
}) {
  const { path = '', saved } = await searchParams;

  const session = await getSession();
  if (!session) {
    redirect(`/admin/login?next=%2Fadmin%2Fpages%2Fedit%3Fpath%3D${encodeURIComponent(path)}`);
  }

  const [counts, page] = await Promise.all([getCounts(), path ? getPage(path) : null]);
  if (!page) notFound();

  return (
    <AdminShell
      current="pages"
      email={session.email}
      counts={counts}
      title={page.name || page.path}
      subtitle={`${page.path} — family: ${page.family}`}
    >
      <PageForm page={page} saved={saved === '1'} />
    </AdminShell>
  );
}
