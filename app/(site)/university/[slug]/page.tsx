import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import UniversityDetail from '@/components/templates/UniversityDetail';
import { getUniversities, getUniversity } from '@/lib/models/universities';
import { getCourseCategories } from '@/lib/models/course-categories';

/**
 * Renders from the `universities` collection's structured fields rather than the
 * old `pages.contentHtml` blob, so the admin can edit it.
 *
 * The `pages` documents are intentionally left in the database: reverting to the
 * blob is a one-line change here if a fidelity problem turns up.
 */
export async function generateStaticParams() {
  const all = await getUniversities();
  return all.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const u = await getUniversity(slug);
  if (!u) return {};
  return {
    title: u.seo?.title,
    description: u.seo?.description,
    keywords: u.seo?.keywords,
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = await getUniversity(slug);
  if (!u) notFound();

  // The Courses section is a relation, so resolve the ids to names for display.
  const all = await getCourseCategories();
  const ids = new Set(u.courseIds ?? []);
  const courses = all.filter((c) => ids.has(c.id));

  return <UniversityDetail university={u} courses={courses} />;
}
