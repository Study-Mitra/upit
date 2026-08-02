import { NextResponse } from 'next/server';
import { slugsForCompareIds } from '@/lib/models/universities';

/**
 * Contract verified against the reference endpoint:
 *   {"status":"200","msg":"Saved Successfully","data":[slug, ...]}
 *
 * The client (public/assets/js/inline/inline-08.js) checks `response.status == 200`
 * loosely, then builds "/compare/" + data.join("/"), so `data` must be SLUGS in
 * database order — not the order the ids were supplied in.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = [
    ...url.searchParams.getAll('university_ids[]'),
    ...url.searchParams.getAll('university_ids'),
  ].filter(Boolean);

  const data = ids.length ? await slugsForCompareIds(ids) : [];
  return NextResponse.json({ status: '200', msg: 'Saved Successfully', data });
}
