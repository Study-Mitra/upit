import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import { getCounts } from '@/lib/admin/counts';
import { getLeads, LEAD_STATUSES } from '@/lib/models/leads';
import AdminShell from '@/components/admin/AdminShell';
import { saveLead, removeLead } from './actions';

export const metadata = {
  title: 'Leads — SRM Education Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function when(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Fixed locale and UTC: the server and browser must not disagree, or the
  // rendered date changes between SSR and hydration.
  return d.toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; saved?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/admin/login?next=%2Fadmin%2Fleads');

  const { status = 'all', q = '', saved } = await searchParams;
  const [counts, leads] = await Promise.all([getCounts(), getLeads({ status, q })]);

  return (
    <AdminShell
      current="leads"
      email={session.email}
      counts={counts}
      title="Leads"
      subtitle={`${leads.length} shown${status !== 'all' ? ` · status: ${status}` : ''}${q ? ` · matching "${q}"` : ''}`}
      actions={
        <a className="a-btn" href="/admin/leads/export">
          Export CSV
        </a>
      }
    >
      {saved === '1' ? (
        <p className="a-msg a-msg-success" role="status">
          Lead updated.
        </p>
      ) : null}

      <form className="a-toolbar" method="get">
        <input
          className="a-input"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, email, phone, course…"
        />
        <select className="a-select" name="status" defaultValue={status} style={{ maxWidth: 180 }}>
          <option value="all">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="a-btn" type="submit">
          Filter
        </button>
        {q || status !== 'all' ? (
          <a className="a-btn" href="/admin/leads">
            Clear
          </a>
        ) : null}
      </form>

      <div className="a-card a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <th>Received</th>
              <th>Name</th>
              <th>Contact</th>
              <th>Course</th>
              <th>State</th>
              <th>Status &amp; notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{when(l.createdAt)}</td>
                <td>{l.name || '—'}</td>
                <td>
                  {l.contact ? <a href={`tel:${l.contact}`}>{l.contact}</a> : '—'}
                  {l.email ? (
                    <div style={{ fontSize: 12 }}>
                      <a href={`mailto:${l.email}`}>{l.email}</a>
                    </div>
                  ) : null}
                </td>
                <td>{l.course || '—'}</td>
                <td>{l.state || '—'}</td>
                <td>
                  {/* Inline form so a status change is one action, not a page hop. */}
                  <form action={saveLead} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="hidden" name="id" value={l.id} />
                    <select className="a-select" name="status" defaultValue={l.status} style={{ maxWidth: 130 }}>
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      className="a-input"
                      name="notes"
                      defaultValue={l.notes}
                      placeholder="notes"
                      style={{ minWidth: 130 }}
                    />
                    <button className="a-btn" type="submit">
                      Save
                    </button>
                  </form>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <form action={removeLead}>
                    <input type="hidden" name="id" value={l.id} />
                    <button className="a-btn a-btn-danger" type="submit">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 ? (
          <div className="a-empty">No leads match this filter.</div>
        ) : null}
      </div>
    </AdminShell>
  );
}
