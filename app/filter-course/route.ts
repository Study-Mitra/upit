import { getDb } from '@/lib/mongodb';
import type { University } from '@/lib/models/universities';

/**
 * Filter the /university card grid by course (or sub-course).
 *
 * Contract from the university page script:
 *   request : ?course_id= | ?sub_course_id=
 *   response: a raw HTML FRAGMENT — the client does
 *             `$('#university-list').html(response)` and then counts
 *             `.rbt-card` itself, so no JSON envelope.
 *
 * Matching uses the `data-courses` attribute captured off each card, which is
 * the same key the reference filters on.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseId = (url.searchParams.get('course_id') ?? '').trim();
  const subCourseId = (url.searchParams.get('sub_course_id') ?? '').trim();
  const id = subCourseId || courseId;

  const db = await getDb();
  const query = id ? { courseIds: id } : {};
  const unis = await db
    .collection<University & { cardHtml: string }>('universities')
    .find(query, { projection: { _id: 0, cardHtml: 1 } })
    .toArray();

  const html = unis.map((u) => u.cardHtml).join('\n');
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
