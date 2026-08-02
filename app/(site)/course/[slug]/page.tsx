import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PageScripts from '@/components/PageScripts';
import CourseDetail from '@/components/templates/CourseDetail';
import CourseListing from '@/components/templates/CourseListing';
import { getAllCourseSlugs, getCourse } from '@/lib/models/courses';

/**
 * All 49 /course/* pages. Prerendered from MongoDB at build time so the admin's
 * edits flow through a revalidatePath() call rather than a rebuild.
 */
export async function generateStaticParams() {
  const slugs = await getAllCourseSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) return {};
  return {
    title: course.seo.title,
    description: course.seo.description,
    keywords: course.seo.keywords,
  };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) notFound();

  return (
    <>
      <PageScripts path={course.path} />
      {course.kind === 'listing' ? (
        <CourseListing course={course} />
      ) : (
        <CourseDetail course={course} />
      )}
    </>
  );
}
