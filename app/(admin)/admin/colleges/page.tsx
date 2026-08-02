import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import { getCounts } from '@/lib/admin/counts';
import { getUniversities } from '@/lib/models/universities';
import AdminShell from '@/components/admin/AdminShell';

export const metadata = {
  title: 'Colleges — UPIT College of Education Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CollegesPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login?next=%2Fadmin%2Fcolleges');

  const [counts, all] = await Promise.all([getCounts(), getUniversities()]);
  const colleges = [...all].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AdminShell
      current="colleges"
      email={session.email}
      counts={counts}
      title="Colleges"
      subtitle={`${colleges.length} colleges. Changes go live immediately.`}
      actions={
        <a className="a-btn a-btn-primary" href="/admin/colleges/new">
          Add college
        </a>
      }
    >
      <div className="a-card a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th>Compare&nbsp;ID</th>
              <th>Courses</th>
              <th>Approvals</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {colleges.map((u) => {
              const courseCount = (u.courseIds ?? []).length;
              return (
                <tr key={u.slug}>
                  <td>
                    <a href={`/admin/colleges/${u.slug}`}>{u.name}</a>
                    <div style={{ color: 'var(--a-muted)', fontSize: 12 }}>/{u.slug}</div>
                  </td>
                  <td>{u.location || <span style={{ color: 'var(--a-muted)' }}>—</span>}</td>
                  <td>{u.compareId ?? <span className="a-badge">none</span>}</td>
                  <td>
                    {courseCount === 0 ? (
                      // Flagged, not silently fixed: the old carousel markup was
                      // generated FROM courseIds, so there is no source to
                      // recover these from — they need assigning by hand.
                      <span className="a-badge a-badge-contacted" title="No courses assigned — the Courses carousel will be empty and this college never matches the course filter">
                        none
                      </span>
                    ) : (
                      courseCount
                    )}
                  </td>
                  <td>{(u.approvals ?? u.badges ?? []).length}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <a className="a-btn" href={`/university/${u.slug}`} target="_blank" rel="noreferrer">
                      View
                    </a>{' '}
                    <a className="a-btn" href={`/admin/colleges/${u.slug}`}>
                      Edit
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {colleges.length === 0 ? <div className="a-empty">No colleges yet.</div> : null}
      </div>
    </AdminShell>
  );
}
