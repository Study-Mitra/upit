import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import { getCounts } from '@/lib/admin/counts';
import { getCourseCategories } from '@/lib/models/course-categories';
import AdminShell from '@/components/admin/AdminShell';
import CollegeForm from '../CollegeForm';

export const metadata = {
  title: 'Add college — SRM Education Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function NewCollegePage() {
  const session = await getSession();
  if (!session) redirect('/admin/login?next=%2Fadmin%2Fcolleges%2Fnew');

  const [counts, courses] = await Promise.all([getCounts(), getCourseCategories()]);

  return (
    <AdminShell
      current="colleges"
      email={session.email}
      counts={counts}
      title="Add college"
      subtitle="A Compare ID is allocated automatically so comparison works straight away."
    >
      <CollegeForm mode="create" college={{}} courses={courses} />
    </AdminShell>
  );
}
