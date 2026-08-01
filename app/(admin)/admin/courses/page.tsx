import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import { getCounts } from '@/lib/admin/counts';
import { getCourses } from '@/lib/models/courses';
import AdminShell from '@/components/admin/AdminShell';

export const metadata = {
  title: 'Courses — SRM Education Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CoursesPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login?next=%2Fadmin%2Fcourses');

  const [counts, all] = await Promise.all([getCounts(), getCourses()]);
  const courses = [...all].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AdminShell
      current="courses"
      email={session.email}
      counts={counts}
      title="Courses"
      subtitle={`${courses.length} courses. Changes go live immediately.`}
      actions={
        <a className="a-btn a-btn-primary" href="/admin/courses/new">
          Add course
        </a>
      }
    >
      <div className="a-card a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Detail rows</th>
              <th>FAQ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.slug}>
                <td>
                  <a href={`/admin/courses/${c.slug}`}>{c.name}</a>
                  <div style={{ color: 'var(--a-muted)', fontSize: 12 }}>/{c.slug}</div>
                </td>
                <td>
                  <span className={`a-badge${c.kind === 'listing' ? ' a-badge-new' : ''}`}>
                    {c.kind}
                  </span>
                </td>
                <td>
                  {(c.details ?? []).length || (
                    <span className="a-badge a-badge-contacted" title="No detail rows — the details panel renders empty">
                      none
                    </span>
                  )}
                </td>
                <td>{c.faqHtml ? 'yes' : <span style={{ color: 'var(--a-muted)' }}>—</span>}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <a className="a-btn" href={`/course/${c.slug}`} target="_blank" rel="noreferrer">
                    View
                  </a>{' '}
                  <a className="a-btn" href={`/admin/courses/${c.slug}`}>
                    Edit
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {courses.length === 0 ? <div className="a-empty">No courses yet.</div> : null}
      </div>
    </AdminShell>
  );
}
