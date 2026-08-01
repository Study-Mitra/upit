'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import { sanitizeHtml, sanitizeText } from '@/lib/admin/sanitize';
import { renderUniversityCard } from '@/lib/admin/card';
import {
  createUniversity,
  updateUniversity,
  deleteUniversity,
  getUniversity,
  nextCompareId,
  slugExists,
  type Approval,
  type University,
} from '@/lib/models/universities';

export type SaveState = { error: string | null; ok?: boolean };

/** Every admin mutation re-checks the session; never trust the middleware alone. */
async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/admin/login?next=%2Fadmin%2Fcolleges');
  return session;
}

/** Repeated `approvalLabel`/`approvalLogo` inputs become one array. */
function readApprovals(formData: FormData): Approval[] {
  const labels = formData.getAll('approvalLabel').map((v) => sanitizeText(String(v)));
  const logos = formData.getAll('approvalLogo').map((v) => sanitizeText(String(v)));
  return labels
    .map((label, i) => ({ label, logoUrl: logos[i] ?? '' }))
    .filter((a) => a.label || a.logoUrl);
}

/** Split a comma/newline separated list into trimmed non-empty values. */
function readList(formData: FormData, field: string): string[] {
  return String(formData.get(field) ?? '')
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Fields shared by create and update.
 *
 * `cardHtml` and `badges` are derived here rather than being editable: cardHtml
 * is consumed verbatim by the three filter endpoints, and badges must stay in
 * step with approvals or the card pills and the Approvals section disagree.
 */
function readFields(formData: FormData) {
  const approvals = readApprovals(formData);
  return {
    name: sanitizeText(String(formData.get('name') ?? '')),
    detailName: sanitizeText(String(formData.get('detailName') ?? '')),
    compareName: sanitizeText(String(formData.get('compareName') ?? '')),
    logo: sanitizeText(String(formData.get('logo') ?? '')),
    banner: sanitizeText(String(formData.get('banner') ?? '')),
    location: sanitizeText(String(formData.get('location') ?? '')),
    excerpt: sanitizeText(String(formData.get('excerpt') ?? '')),
    approvals,
    badges: approvals.map((a) => a.label).filter(Boolean),
    courseIds: readList(formData, 'courseIds'),
    modeIds: readList(formData, 'modeIds'),
    about: sanitizeHtml(String(formData.get('about') ?? '')),
    approvalsHtml: sanitizeHtml(String(formData.get('approvalsHtml') ?? '')),
    keyFeatures: sanitizeHtml(String(formData.get('keyFeatures') ?? '')),
    admissionProcess: sanitizeHtml(String(formData.get('admissionProcess') ?? '')),
    careerProcess: sanitizeHtml(String(formData.get('careerProcess') ?? '')),
    reviews: sanitizeHtml(String(formData.get('reviews') ?? '')),
    seo: {
      title: sanitizeText(String(formData.get('seoTitle') ?? '')),
      description: sanitizeText(String(formData.get('seoDescription') ?? '')),
      keywords: sanitizeText(String(formData.get('seoKeywords') ?? '')),
    },
  };
}

/** Public paths affected by a college change. */
function revalidateCollege(slug: string) {
  revalidatePath('/university');
  revalidatePath(`/university/${slug}`);
}

export async function createCollege(_prev: SaveState, formData: FormData): Promise<SaveState> {
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
  if (await slugExists(slug)) return { error: `Slug "${slug}" is already taken.` };

  // Allocated, never operator-supplied: the whole compare feature keys off it.
  const compareId = await nextCompareId();

  const doc: University = {
    slug,
    path: `/university/${slug}`,
    compareId,
    elementId: `uni-${compareId}`,
    ...fields,
    compareName: fields.compareName || fields.name,
    detailName: fields.detailName || fields.name,
  } as University;

  doc.cardHtml = renderUniversityCard(doc);

  await createUniversity(doc);
  revalidateCollege(slug);
  redirect(`/admin/colleges/${slug}?saved=1`);
}

export async function updateCollege(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireSession();

  const slug = sanitizeText(String(formData.get('slug') ?? ''));
  const existing = await getUniversity(slug);
  if (!existing) return { error: 'That college no longer exists.' };

  const fields = readFields(formData);
  if (!fields.name) return { error: 'Name is required.' };

  const merged: University = {
    ...existing,
    ...fields,
    compareName: fields.compareName || fields.name,
    detailName: fields.detailName || fields.name,
  };
  // Regenerate the derived card from the new field values.
  merged.cardHtml = renderUniversityCard(merged);

  await updateUniversity(slug, {
    ...fields,
    compareName: merged.compareName,
    detailName: merged.detailName,
    cardHtml: merged.cardHtml,
  });

  revalidateCollege(slug);
  return { error: null, ok: true };
}

/**
 * Clone a college as the starting point for a new one.
 *
 * Everything is copied except the three things that must be unique: `slug` (gets
 * a `-copy` suffix, deduplicated), `compareId` (freshly allocated, or the
 * original and the copy would collide in the comparison feature) and the derived
 * `elementId`/`cardHtml`, which are regenerated from the new values.
 *
 * The copy's name is suffixed too, so the two are distinguishable in the list
 * rather than appearing as identical rows.
 */
export async function duplicateCollege(formData: FormData): Promise<void> {
  await requireSession();
  const slug = sanitizeText(String(formData.get('slug') ?? ''));
  const source = await getUniversity(slug);
  if (!source) redirect('/admin/colleges');

  let candidate = `${slug}-copy`;
  for (let n = 2; await slugExists(candidate); n++) candidate = `${slug}-copy-${n}`;

  const compareId = await nextCompareId();
  const copy: University = {
    ...source,
    slug: candidate,
    path: `/university/${candidate}`,
    name: `${source.name} (copy)`,
    compareId,
    elementId: `uni-${compareId}`,
  };
  copy.cardHtml = renderUniversityCard(copy);

  await createUniversity(copy);
  revalidateCollege(candidate);
  redirect(`/admin/colleges/${candidate}?saved=1`);
}

export async function deleteCollege(formData: FormData): Promise<void> {
  await requireSession();
  const slug = sanitizeText(String(formData.get('slug') ?? ''));
  if (slug) {
    await deleteUniversity(slug);
    revalidateCollege(slug);
  }
  redirect('/admin/colleges');
}
