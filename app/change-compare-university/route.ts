import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { University } from '@/lib/models/universities';

/**
 * Drives the three university dropdowns on /compare-university.
 *
 * CONTRACT — read from every branch of public/assets/js/page/p-08397d683a.js,
 * not just the first one. All three change handlers rebuild their *sibling*
 * dropdowns from arrays in this response and re-mark the current selection:
 *
 *   #set_university_card_first  change -> universities | university_sec + university_third
 *   #set_university_card_sec    change -> university_frst + university_third
 *   #set_university_card_third  change -> university_first + university_sec
 *
 * Each is an array of { id, name }; the aliases are inconsistent in the script
 * ("frst" vs "first"), so every spelling it reads is returned. Omitting them is
 * not a harmless gap: the script does
 *
 *   $.each(response.university_sec, ...);            // undefined -> jQuery no-op
 *   $('#set_university_card_sec').html(options);     // ...so this writes ONLY
 *                                                    //    the disabled placeholder
 *
 * which silently empties the sibling dropdown and makes a second or third
 * university unselectable — i.e. comparison becomes impossible.
 *
 * The uni_first/uni_sec/uni_third objects need an `id` too, because the script
 * compares `response.uni_sec.id == val.id` to re-apply `selected`.
 */

/** Placeholder for an unfilled slot. */
const EMPTY = { id: '', name: '', logo: '' };

/**
 * Unfilled slots are returned as this object rather than null on purpose.
 *
 * The script guards the logo with `if (response.uni_first && ...logo)`, so an
 * empty string correctly hides the image — but it does NOT guard
 * `response.uni_first.id` inside the $.each callbacks. A null there throws
 * mid-loop and aborts the rest of the success handler, leaving the remaining
 * dropdowns and logos unupdated. An empty id simply matches no option.
 *
 * It also keeps `response.uni_third && response.uni_sec` truthy in the first
 * handler, which selects the branch that re-marks existing selections instead
 * of the one that discards them.
 */
function shape(uni: University | undefined) {
  if (!uni) return EMPTY;
  return {
    id: uni.compareId ?? '',
    name: uni.name,
    // The client does `.attr('src', '/' + logo)`. Stored paths already start
    // with "/", and "//new-assets/..." is protocol-relative — a different host.
    logo: uni.logo.replace(/^\/+/, ''),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const param = (name: string) => url.searchParams.get(name)?.trim() ?? '';

  // The second and third handlers spell the first slot "university_id_frst".
  const first = param('university_id') || param('university_id_frst');
  const sec = param('university_id_sec');
  const third = param('university_id_third');
  const courseId = param('course_id');

  const db = await getDb();

  // Same course filter as /get-universities, so changing a slot cannot widen
  // the list beyond what the chosen course offers.
  const candidates = await db
    .collection<University>('universities')
    .find(courseId ? { courseIds: courseId } : {}, { projection: { _id: 0 } })
    .toArray();

  const byCompareId = new Map(
    candidates.filter((u) => u.compareId).map((u) => [u.compareId as string, u])
  );
  const options = candidates
    .filter((u) => u.compareId)
    .map((u) => ({ id: u.compareId, name: u.name }));

  return NextResponse.json({
    status: 200,
    uni_first: shape(byCompareId.get(first)),
    uni_sec: shape(byCompareId.get(sec)),
    uni_third: shape(byCompareId.get(third)),
    // Every alias the page script reads. Same list each time: the script
    // preserves the user's choice via the `selected` attribute rather than by
    // receiving a pre-filtered list.
    universities: options,
    university_first: options,
    university_frst: options,
    university_sec: options,
    university_third: options,
  });
}
