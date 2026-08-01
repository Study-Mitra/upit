'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/mongodb';
import { getSession } from '@/lib/admin/auth';
import { sanitizeHtml, sanitizeText } from '@/lib/admin/sanitize';
import { getPage } from '@/lib/models/pages';
import { LOCKED_PAGE_FAMILY_SET } from '@/lib/admin/locked-pages';

export type SaveState = { error: string | null; ok?: boolean };

const COLLECTION = 'pages';

async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/admin/login?next=%2Fadmin%2Fpages');
  return session;
}

export async function updatePage(_prev: SaveState, formData: FormData): Promise<SaveState> {
  await requireSession();

  const path = sanitizeText(String(formData.get('path') ?? ''));
  const existing = await getPage(path);
  if (!existing) return { error: 'That page no longer exists.' };
  if (LOCKED_PAGE_FAMILY_SET.has(existing.family)) {
    return { error: `Pages in the "${existing.family}" family are not editable here.` };
  }

  const name = sanitizeText(String(formData.get('name') ?? ''));
  const contentHtml = sanitizeHtml(String(formData.get('contentHtml') ?? ''));

  // A blank body would wipe the page; almost always an editor that failed to
  // mount rather than a deliberate edit.
  if (!contentHtml.trim()) {
    return { error: 'Content is empty — refusing to blank the page. Reload and try again.' };
  }

  const db = await getDb();
  await db.collection(COLLECTION).updateOne(
    { path },
    {
      $set: {
        name,
        contentHtml,
        seo: {
          title: sanitizeText(String(formData.get('seoTitle') ?? '')),
          description: sanitizeText(String(formData.get('seoDescription') ?? '')),
          keywords: sanitizeText(String(formData.get('seoKeywords') ?? '')),
        },
        updatedAt: new Date(),
      },
    }
  );

  revalidatePath(path);
  return { error: null, ok: true };
}
