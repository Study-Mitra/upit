import { getDb } from '@/lib/mongodb';
import type { NavCounts } from '@/components/admin/AdminShell';
import { EDITABLE_PAGES_FILTER } from '@/lib/admin/locked-pages';

/**
 * Record counts for the sidebar badges and dashboard tiles.
 *
 * `pages` counts only what the Pages screen will actually open — the same filter
 * that screen uses. Counting the hidden families here made the badge say 93 while
 * the list said "91 editable", which reads as a bug rather than as a deliberate
 * exclusion.
 */
export async function getCounts(): Promise<NavCounts> {
  const db = await getDb();
  const [colleges, courses, pages, leads] = await Promise.all([
    db.collection('universities').countDocuments(),
    db.collection('courses').countDocuments(),
    db.collection('pages').countDocuments(EDITABLE_PAGES_FILTER),
    db.collection('leads').countDocuments(),
  ]);
  return { colleges, courses, pages, leads };
}
