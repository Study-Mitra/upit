import { getDb } from '@/lib/mongodb';
import type { Seo } from '@/lib/models/courses';

/**
 * Generic page record: the whole content region stored as HTML.
 *
 * Used by every family except `course`. The admin-editable families
 * (university, blog, specialization) will gain field-level structure in the
 * admin phase; until then this guarantees every page renders exactly.
 */
export type PageDoc = {
  slug: string;
  path: string;
  family: string;
  name: string;
  contentHtml: string;
  segment: string;
  seo: Seo;
};

const COLLECTION = 'pages';

export async function getPage(path: string): Promise<PageDoc | null> {
  const db = await getDb();
  return db.collection<PageDoc>(COLLECTION).findOne({ path }, { projection: { _id: 0 } });
}

export async function getPagesByFamily(family: string): Promise<PageDoc[]> {
  const db = await getDb();
  return db
    .collection<PageDoc>(COLLECTION)
    .find({ family }, { projection: { _id: 0 } })
    .sort({ path: 1 })
    .toArray();
}

export async function getSlugsByFamily(family: string): Promise<string[]> {
  const pages = await getPagesByFamily(family);
  // Detail routes are keyed by the last path segment.
  return pages
    .filter((p) => p.path.split('/').filter(Boolean).length > 1)
    .map((p) => p.path.split('/').filter(Boolean).slice(1).join('/'));
}
