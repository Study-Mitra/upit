import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import { getCounts } from '@/lib/admin/counts';
import { getDb } from '@/lib/mongodb';
import AdminShell from '@/components/admin/AdminShell';
import { LOCKED_PAGE_FAMILY_SET } from '@/lib/admin/locked-pages';

export const metadata = {
  title: 'Pages — SRM Education Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<{ family?: string; q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/admin/login?next=%2Fadmin%2Fpages');

  const { family = 'all', q = '' } = await searchParams;
  const [counts, db] = await Promise.all([getCounts(), getDb()]);

  const all = await db
    .collection('pages')
    .find({}, { projection: { _id: 0, path: 1, name: 1, family: 1, contentHtml: 1, seo: 1 } })
    .sort({ path: 1 })
    .toArray();

  const families = [...new Set(all.map((p) => String(p.family)))].sort();
  const rows = all
    .filter((p) => !LOCKED_PAGE_FAMILY_SET.has(String(p.family)))
    .filter((p) => family === 'all' || String(p.family) === family)
    .filter((p) => {
      if (!q) return true;
      const needle = q.toLowerCase();
      return (
        String(p.path).toLowerCase().includes(needle) ||
        String(p.name ?? '').toLowerCase().includes(needle)
      );
    });

  const lockedCount = all.filter((p) => LOCKED_PAGE_FAMILY_SET.has(String(p.family))).length;

  return (
    <AdminShell
      current="pages"
      email={session.email}
      counts={counts}
      title="Pages"
      subtitle={`${rows.length} editable${family !== 'all' ? ` in "${family}"` : ''}. Changes go live immediately.`}
    >
      <form className="a-toolbar" method="get">
        <input
          className="a-input"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search path or title…"
        />
        <select className="a-select" name="family" defaultValue={family} style={{ maxWidth: 220 }}>
          <option value="all">All families</option>
          {families
            .filter((f) => !LOCKED_PAGE_FAMILY_SET.has(f))
            .map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
        </select>
        <button className="a-btn" type="submit">
          Filter
        </button>
        {q || family !== 'all' ? (
          <a className="a-btn" href="/admin/pages">
            Clear
          </a>
        ) : null}
      </form>

      <div className="a-card a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Path</th>
              <th>Family</th>
              <th>Size</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={String(p.path)}>
                <td>
                  <a href={`/admin/pages/edit?path=${encodeURIComponent(String(p.path))}`}>
                    {String(p.name || '(untitled)')}
                  </a>
                </td>
                <td style={{ color: 'var(--a-muted)' }}>{String(p.path)}</td>
                <td>
                  <span className="a-badge">{String(p.family)}</span>
                </td>
                <td>{Math.round(String(p.contentHtml ?? '').length / 1024)} KB</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <a className="a-btn" href={String(p.path)} target="_blank" rel="noreferrer">
                    View
                  </a>{' '}
                  <a
                    className="a-btn"
                    href={`/admin/pages/edit?path=${encodeURIComponent(String(p.path))}`}
                  >
                    Edit
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <div className="a-empty">No pages match this filter.</div> : null}
      </div>

      <p className="a-hint" style={{ marginTop: 14 }}>
        {lockedCount} pages are hidden on purpose. The {lockedCount === 1 ? 'page' : 'pages'} in the
        university, root and compare-university families either render from somewhere else or are
        kept only as a migration rollback — editing them here would appear to work and change
        nothing. Colleges are edited under <a href="/admin/colleges">Colleges</a>.
      </p>
    </AdminShell>
  );
}
