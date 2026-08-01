import { getDb } from '@/lib/mongodb';
import type { Seo } from '@/lib/models/courses';

export type Approval = { label: string; logoUrl: string };

export type University = {
  slug: string;
  path: string;
  name: string;
  compareId: string | null;
  compareName: string | null;
  detailName?: string;
  logo: string;
  banner?: string;
  location: string;
  badges: string[];
  excerpt: string;
  seo: Seo;

  about?: string;
  approvalsHtml?: string;
  approvals?: Approval[];
  keyFeatures?: string;
  admissionProcess?: string;
  careerProcess?: string;
  reviews?: string;

  courseIds?: string[];
  modeIds?: string[];

  cardHtml?: string;
  elementId?: string;
};

const COLLECTION = 'universities';

export async function getUniversities(): Promise<University[]> {
  const db = await getDb();
  return db.collection<University>(COLLECTION).find({}, { projection: { _id: 0 } }).toArray();
}


export async function slugsForCompareIds(ids: string[]): Promise<string[]> {
  const db = await getDb();
  const docs = await db
    .collection<University>(COLLECTION)
    .find({ compareId: { $in: ids } }, { projection: { _id: 0, slug: 1 } })
    .toArray();
  return docs.map((d) => d.slug);
}


export async function slugsForCompareIdsOrdered(ids: string[]): Promise<string[]> {
  const db = await getDb();
  const docs = await db
    .collection<University>(COLLECTION)
    .find({ compareId: { $in: ids } }, { projection: { _id: 0, slug: 1, compareId: 1 } })
    .toArray();
  const byId = new Map(docs.map((d) => [d.compareId, d.slug]));
  return ids.map((id) => byId.get(id)).filter((s): s is string => Boolean(s));
}

export async function getUniversity(slug: string): Promise<University | null> {
  const db = await getDb();
  return db.collection<University>(COLLECTION).findOne({ slug }, { projection: { _id: 0 } });
}


export async function nextCompareId(): Promise<string> {
  const db = await getDb();
  const docs = await db
    .collection<University>(COLLECTION)
    .find({}, { projection: { _id: 0, compareId: 1 } })
    .toArray();
  const max = docs.reduce((acc, d) => {
    const n = Number(d.compareId);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return String(max + 1);
}

export async function createUniversity(doc: University): Promise<void> {
  const db = await getDb();
  await db.collection<University>(COLLECTION).insertOne({ ...doc } as University);
}

export async function updateUniversity(
  slug: string,
  patch: Partial<University>
): Promise<void> {
  const db = await getDb();
  await db.collection<University>(COLLECTION).updateOne({ slug }, { $set: patch });
}

export async function deleteUniversity(slug: string): Promise<void> {
  const db = await getDb();
  await db.collection<University>(COLLECTION).deleteOne({ slug });
}

/** True when the slug is already taken — checked before insert. */
export async function slugExists(slug: string): Promise<boolean> {
  const db = await getDb();
  const n = await db.collection<University>(COLLECTION).countDocuments({ slug }, { limit: 1 });
  return n > 0;
}

export async function universitiesByCompareId(
  ids: string[]
): Promise<Map<string, University>> {
  const db = await getDb();
  const docs = await db
    .collection<University>(COLLECTION)
    .find({ compareId: { $in: ids } }, { projection: { _id: 0 } })
    .toArray();
  return new Map(docs.map((d) => [d.compareId as string, d]));
}
