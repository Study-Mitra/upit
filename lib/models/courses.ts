import { getDb } from '@/lib/mongodb';

export type Seo = {
  title: string;
  description: string;
  keywords: string;
};

export type CourseDetailRow = {
  icon: string;
  label: string;
  value: string;
  /** 'block' renders the full-width panel (Eligibility); 'badge' the pill. */
  style: 'block' | 'badge';
};

export type UniversityCard = {
  slug: string;
  href: string;
  name: string;
  logo: string;
  logoAlt: string;
  feeText: string;
};

export type Course = {
  slug: string;
  path: string;
  kind: 'detail' | 'listing';
  name: string;
  aboutHeading: string;
  bannerImage: string;
  /** Free-form WYSIWYG HTML; edited by the admin's rich-text editor. */
  descriptionHtml: string;
  details: CourseDetailRow[];
  universitiesOffering: { heading: string; cards: UniversityCard[] } | null;
  /** Optional FAQ accordion, stored as raw HTML. */
  faqHtml: string | null;
  /** Listing pages (/course/online, /course/regular) only. */
  bodyHtml?: string;
  seo: Seo;
};

const COLLECTION = 'courses';

export async function getAllCourseSlugs(): Promise<string[]> {
  const db = await getDb();
  const docs = await db
    .collection<Course>(COLLECTION)
    .find({}, { projection: { slug: 1 } })
    .toArray();
  return docs.map((d) => d.slug);
}

export async function getCourse(slug: string): Promise<Course | null> {
  const db = await getDb();
  return db
    .collection<Course>(COLLECTION)
    .findOne({ slug }, { projection: { _id: 0 } });
}

export async function getCourses(
  filter: Partial<Pick<Course, 'kind'>> = {}
): Promise<Course[]> {
  const db = await getDb();
  return db
    .collection<Course>(COLLECTION)
    .find(filter, { projection: { _id: 0 } })
    .sort({ slug: 1 })
    .toArray();
}
