import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

/**
 * Populate the "Select Sub Course" dropdown.
 *
 * Contract from the compare-university page script:
 *   request : ?course_id=
 *   response: { status: 200, subCourses: [{ id, name }] }
 *   the client builds `<option value="${val.id}">${val.name}</option>`
 *
 * Sub-courses are the specialization records that belong to a course. The
 * `specialization` pages are keyed by the parent course slug, so the course id
 * is resolved to a slug first.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseId = (url.searchParams.get('course_id') ?? '').trim();

  if (!courseId) {
    return NextResponse.json({ status: 200, subCourses: [] });
  }

  const db = await getDb();

  // The dropdown supplies the numeric course id used on the university cards.
  // Map it to a course slug, then find that course's specializations.
  const course = await db
    .collection('courses')
    .findOne(
      { $or: [{ courseId }, { slug: courseId }] },
      { projection: { _id: 0, slug: 1 } }
    );

  const parentSlug = course?.slug ?? courseId;

  const specs = await db
    .collection('pages')
    .find(
      { family: 'specialization-details', path: { $regex: `^/specialization-details/${parentSlug}` } },
      { projection: { _id: 0, path: 1, name: 1, seo: 1 } }
    )
    .toArray();

  const subCourses = specs.map((s) => ({
    id: s.path.split('/').filter(Boolean).slice(1).join('/'),
    name: s.name || s.seo?.title || s.path,
  }));

  return NextResponse.json({ status: 200, subCourses });
}
