import { getDb } from '@/lib/mongodb';
import type { University } from '@/lib/models/universities';

/**
 * Filter the /university grid by study mode.
 *
 * Contract: ?mode_id= -> { html, count }. Note this one DOES wrap in JSON
 * (the client reads response.html and response.count), unlike /filter-course
 * which returns a bare fragment. That inconsistency is the reference's, and is
 * reproduced rather than tidied up.
 *
 * Caveat: no university card on the reference currently carries a data-modes
 * value, so every mode filter legitimately matches nothing there too. Once the
 * admin sets modes, this filter starts working without a code change.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const modeId = (url.searchParams.get('mode_id') ?? '').trim();

  const db = await getDb();
  const query = modeId ? { modeIds: modeId } : {};
  const unis = await db
    .collection<University & { cardHtml: string }>('universities')
    .find(query, { projection: { _id: 0, cardHtml: 1 } })
    .toArray();

  return Response.json({ html: unis.map((u) => u.cardHtml).join('\n'), count: unis.length });
}
