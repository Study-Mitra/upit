import { getDb } from '@/lib/mongodb';
import type { University } from '@/lib/models/universities';

/**
 * Filter the /university grid by fee band.
 *
 * Contract: ?price= -> { html, count }.
 *
 * The reference exposes no price data on the cards, so this returns the full
 * set rather than silently emptying the grid — an empty result would look like
 * a broken page. A real `priceBand` field can be set per university in the
 * admin, and is honoured here as soon as it exists.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const price = (url.searchParams.get('price') ?? '').trim();

  const db = await getDb();
  const col = db.collection<University & { cardHtml: string; priceBand?: string }>('universities');

  const withBand = price ? await col.countDocuments({ priceBand: price }) : 0;
  const query = withBand > 0 ? { priceBand: price } : {};

  const unis = await col.find(query, { projection: { _id: 0, cardHtml: 1 } }).toArray();
  return Response.json({ html: unis.map((u) => u.cardHtml).join('\n'), count: unis.length });
}
