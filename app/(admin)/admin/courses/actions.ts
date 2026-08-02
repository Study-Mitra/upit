'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/admin/auth';
import { sanitizeHtml, sanitizeText } from '@/lib/admin/sanitize';
import { checkNoCollapse } from '@/lib/admin/guard';
import { getCourse, type Course, type CourseDetailRow } from '@/lib/models/courses';

export type SaveState = { error: string | null; ok?: boolean };

const COLLECTION = 'courses';

async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/admin/login?next=%2Fadmin%2Fcourses');
  return session;
}

/** Repeated detail inputs become one ordered array of rows. */
function readDetails(formData: FormData): CourseDetailRow[] {
  const icons = formData.getAll('detailIcon').map((v) => sanitizeText(String(v)));
  const labels = formData.getAll('detailLabel').map((v) => sanitizeText(String(v)));
  const values = formData.getAll('detailValue').map((v) => sanitizeText(String(v)));
  const styles = formData.getAll('detailStyle').map((v) => String(v));
  return labels
    .map((label, i) => ({
      icon: icons[i] ?? '',
      label,
      value: values[i] ?? '',
      style: (styles[i] === 'block' ? 'block' : 'badge') as CourseDetailRow['style'],
    }))
    .filter((r) => r.label || r.value);
}

function readFields(formData: FormData) {
  const kind = String(formData.get('kind') ?? 'detail') === 'listing' ? 'listing' : 'detail';
  return {
    name: sanitizeText(String(formData.get('name') ?? '')),
    kind: kind as Course['kind'],
    aboutHeading: sanitizeText(String(formData.get('aboutHeading') ?? '')),
    bannerImage: sanitizeText(String(formData.get('bannerImage') ?? '')),
    descriptionHtml: sanitizeHtml(String(formData.get('descriptionHtml') ?? '')),
    faqHtml: sanitizeHtml(String(formData.get('faqHtml') ?? '')) || null,
    // Only listing pages use bodyHtml; keep it out of detail documents entirely.
    ...(kind === 'listing'
      ? { bodyHtml: sanitizeHtml(String(formData.get('bodyHtml') ?? '')) }
      : {}),
    details: readDetails(formData),
    seo: {
      title: sanitizeText(String(formData.get('seoTitle') ?? '')),
      description: sanitizeText(String(formData.get('seoDescription') ?? '')),
      keywords: sanitizeText(String(formData.get('seoKeywords') ?? '')),
    },
  };
}

/** A course affects its own page and the two listing pages that index courses. */
function revalidateCourse(slug: string) {
  revalidatePath(`/course/${slug}`);
  revalidatePath('/course/online');
  revalidatePath('/course/regular');
}

async function slugTaken(slug: string): Promise<boolean> {
  const db = await getDb();
  return (await db.collection(COLLECTION).countDocuments({ slug }, { limit: 1 })) > 0;
}

export async function createCourse(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireSession();

  const slug = sanitizeText(String(formData.get('slug') ?? ''))
    .toLowerCase()
    .replace(/\s+/g, '-');
  const fields = readFields(formData);

  if (!slug) return { error: 'Slug is required.' };
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: 'Slug may contain only lowercase letters, numbers and hyphens.' };
  }
  if (!fields.name) return { error: 'Name is required.' };
  if (await slugTaken(slug)) return { error: `Slug "${slug}" is already taken.` };

  const db = await getDb();
  await db.collection(COLLECTION).insertOne({
    slug,
    path: `/course/${slug}`,
    universitiesOffering: null,
    ...fields,
    updatedAt: new Date(),
  });

  revalidateCourse(slug);
  redirect(`/admin/courses/${slug}?saved=1`);
}

export async function updateCourse(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireSession();

  const slug = sanitizeText(String(formData.get('slug') ?? ''));
  const existing = await getCourse(slug);
  if (!existing) return { error: 'That course no longer exists.' };

  const fields = readFields(formData);
  if (!fields.name) return { error: 'Name is required.' };

  // Backstop against the visual editor discarding theme markup it cannot model.
  const collapse = checkNoCollapse([
    { label: 'Description', before: existing.descriptionHtml ?? '', after: fields.descriptionHtml },
    { label: 'FAQ', before: existing.faqHtml ?? '', after: fields.faqHtml ?? '' },
    { label: 'Listing body', before: existing.bodyHtml ?? '', after: (fields as { bodyHtml?: string }).bodyHtml ?? existing.bodyHtml ?? '' },
  ]);
  if (!collapse.ok) return { error: collapse.message };

  const db = await getDb();
  // `bodyHtml` is removed when a course stops being a listing, so a stale body
  // cannot resurface if the kind is switched back.
  const unset = fields.kind === 'listing' ? {} : { bodyHtml: '' };
  await db.collection(COLLECTION).updateOne(
    { slug },
    {
      $set: { ...fields, updatedAt: new Date() },
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    }
  );

  revalidateCourse(slug);
  return { error: null, ok: true };
}

/**
 * Clone a course as a starting point for a new one.
 *
 * `slug` gets a deduplicated `-copy` suffix and the name is suffixed too, so the
 * two are distinguishable in the list. Everything else — details rows, the
 * description, FAQ, SEO — is copied, which is the point.
 */
export async function duplicateCourse(formData: FormData): Promise<void> {
  await requireSession();
  const slug = sanitizeText(String(formData.get('slug') ?? ''));
  const source = await getCourse(slug);
  if (!source) redirect('/admin/courses');

  let candidate = `${slug}-copy`;
  for (let n = 2; await slugTaken(candidate); n++) candidate = `${slug}-copy-${n}`;

  const db = await getDb();
  await db.collection(COLLECTION).insertOne({
    ...source,
    slug: candidate,
    path: `/course/${candidate}`,
    name: `${source.name} (copy)`,
    updatedAt: new Date(),
  });

  revalidateCourse(candidate);
  redirect(`/admin/courses/${candidate}?saved=1`);
}

export async function deleteCourse(formData: FormData): Promise<void> {
  await requireSession();
  const slug = sanitizeText(String(formData.get('slug') ?? ''));
  if (slug) {
    const db = await getDb();
    await db.collection(COLLECTION).deleteOne({ slug });
    revalidateCourse(slug);
  }
  redirect('/admin/courses');
}
