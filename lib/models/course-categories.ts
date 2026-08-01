import { getDb } from '@/lib/mongodb';

/**
 * The lookup `universities.courseIds` points at.
 *
 * These numeric ids are inherited from the original Laravel app and are still
 * load-bearing: `/get-universities` and `/filter-course` match on them. The
 * `courses` collection is keyed by slug and has no numeric id, so it cannot serve
 * this purpose. Recovered from the /compare-university markup by
 * scripts/seed-course-categories.mjs.
 */
export type CourseCategory = { id: string; name: string };

export async function getCourseCategories(): Promise<CourseCategory[]> {
  const db = await getDb();
  const docs = await db
    .collection<CourseCategory>('courseCategories')
    .find({}, { projection: { _id: 0, id: 1, name: 1 } })
    .toArray();
  // Numeric ids, so sort numerically — "9" sorts after "36" as text.
  return docs.sort((a, b) => Number(a.id) - Number(b.id));
}
