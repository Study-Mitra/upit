import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import { getCounts } from '@/lib/admin/counts';
import { getCourse } from '@/lib/models/courses';
import AdminShell from '@/components/admin/AdminShell';
import CourseForm from '../CourseForm';
import { deleteCourse, duplicateCourse } from '../actions';

export const metadata = {
  title: 'Edit course — UPIT College of Education Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function EditCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { slug } = await params;
  const { saved } = await searchParams;

  const session = await getSession();
  if (!session) redirect(`/admin/login?next=%2Fadmin%2Fcourses%2F${encodeURIComponent(slug)}`);

  const [counts, course] = await Promise.all([getCounts(), getCourse(slug)]);
  if (!course) notFound();

  return (
    <AdminShell
      current="courses"
      email={session.email}
      counts={counts}
      title={course.name}
      subtitle={`/course/${course.slug} — changes go live immediately.`}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <form action={duplicateCourse}>
            <input type="hidden" name="slug" value={course.slug} />
            <button className="a-btn" type="submit" title="Create a copy with a new slug">
              Duplicate
            </button>
          </form>
          <form action={deleteCourse}>
            <input type="hidden" name="slug" value={course.slug} />
            <button className="a-btn a-btn-danger" type="submit">
              Delete
            </button>
          </form>
        </div>
      }
    >
      <CourseForm mode="edit" course={course} saved={saved === '1'} />
    </AdminShell>
  );
}
