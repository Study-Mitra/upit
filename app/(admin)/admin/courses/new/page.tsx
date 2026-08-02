import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import { getCounts } from '@/lib/admin/counts';
import AdminShell from '@/components/admin/AdminShell';
import CourseForm from '../CourseForm';

export const metadata = {
  title: 'Add course — UPIT College of Education Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewCoursePage() {
  const session = await getSession();
  if (!session) redirect('/admin/login?next=%2Fadmin%2Fcourses%2Fnew');
  const counts = await getCounts();

  return (
    <AdminShell
      current="courses"
      email={session.email}
      counts={counts}
      title="Add course"
      subtitle="Detail pages render the details rows; listing pages render a free-form body."
    >
      <CourseForm mode="create" course={{ kind: 'detail', details: [] }} />
    </AdminShell>
  );
}
