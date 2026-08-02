import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import { getCounts } from '@/lib/admin/counts';
import { getUniversity } from '@/lib/models/universities';
import { getCourseCategories } from '@/lib/models/course-categories';
import AdminShell from '@/components/admin/AdminShell';
import CollegeForm from '../CollegeForm';
import { deleteCollege, duplicateCollege } from '../actions';

export const metadata = {
  title: 'Edit college — UPIT College of Education Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EditCollegePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { slug } = await params;
  const { saved } = await searchParams;

  const session = await getSession();
  if (!session) redirect(`/admin/login?next=%2Fadmin%2Fcolleges%2F${encodeURIComponent(slug)}`);

  const [counts, college, courses] = await Promise.all([
    getCounts(),
    getUniversity(slug),
    getCourseCategories(),
  ]);
  if (!college) notFound();

  return (
    <AdminShell
      current="colleges"
      email={session.email}
      counts={counts}
      title={college.name}
      subtitle={`/university/${college.slug} — changes go live immediately.`}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <form action={duplicateCollege}>
            <input type="hidden" name="slug" value={college.slug} />
            <button className="a-btn" type="submit" title="Create a copy with a new slug and Compare ID">
              Duplicate
            </button>
          </form>
          <form action={deleteCollege}>
            <input type="hidden" name="slug" value={college.slug} />
            <button className="a-btn a-btn-danger" type="submit">
              Delete
            </button>
          </form>
        </div>
      }
    >
      <CollegeForm mode="edit" college={college} courses={courses} saved={saved === '1'} />
    </AdminShell>
  );
}
