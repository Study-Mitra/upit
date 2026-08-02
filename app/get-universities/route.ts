import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { University } from '@/lib/models/universities';

/**
 * Populate the three "Select Your university" dropdowns on /compare-university.
 *
 * Contract from the page script:
 *   request : ?course_id=&sub_course_id=
 *   response: { status: 200, universities: [{ id, name }] }
 *   the client builds `<option value="${val.id}">${val.name}</option>`, and that
 *   `id` is later posted to /get-uni-slug and /change-compare-university — so it
 *   must be the compare id, not the slug.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseId = (url.searchParams.get('course_id') ?? '').trim();

  const db = await getDb();
  const query = courseId ? { courseIds: courseId } : {};

  const unis = await db
    .collection<University>('universities')
    .find(query, { projection: { _id: 0, compareId: 1, name: 1 } })
    .toArray();

  return NextResponse.json({
    status: 200,
    universities: unis
      .filter((u) => u.compareId)
      .map((u) => ({ id: u.compareId, name: u.name })),
  });
}
