import { NextResponse } from 'next/server';
import { slugsForCompareIdsOrdered } from '@/lib/models/universities';

/**
 * Resolve the three compare dropdowns to slugs.
 *
 * Contract from the compare-university page script:
 *   request : ?university_id=&university_id_sec=&university_id_third=&sub_course_id=
 *   response: { status: 200, universities: [slug, ...] }
 *
 * The client builds "/compare/" + universities.join("/"), so the order must
 * follow the user's first/second/third selection, and blank selections must be
 * dropped rather than producing empty path segments.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = [
    url.searchParams.get('university_id'),
    url.searchParams.get('university_id_sec'),
    url.searchParams.get('university_id_third'),
  ]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));

  const universities = ids.length ? await slugsForCompareIdsOrdered(ids) : [];
  return NextResponse.json({ status: 200, universities });
}
