import { getDb } from '@/lib/mongodb';
import type { NavCounts } from '@/components/admin/AdminShell';

/**
 * Record counts for the sidebar badges and dashboard tiles.
 *
 * `pages` excludes the 20 university-family records: those are the college
 * detail pages, already counted under colleges, and counting them twice would
 * overstate how much generic content exists.
 */
export async function getCounts(): Promise<NavCounts> {
  const db = await getDb();
  const [colleges, courses, pages, leads] = await Promise.all([
    db.collection('universities').countDocuments(),
    db.collection('courses').countDocuments(),
    db.collection('pages').countDocuments({ family: { $ne: 'university' } }),
    db.collection('leads').countDocuments(),
  ]);
  return { colleges, courses, pages, leads };
}
