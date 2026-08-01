'use server';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import { sanitizeText } from '@/lib/admin/sanitize';
import { deleteLead, updateLead, LEAD_STATUSES, type LeadStatus } from '@/lib/models/leads';

async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/admin/login?next=%2Fadmin%2Fleads');
}

export async function saveLead(formData: FormData): Promise<void> {
  await requireSession();
  const id = sanitizeText(String(formData.get('id') ?? ''));
  const status = String(formData.get('status') ?? '');
  const notes = sanitizeText(String(formData.get('notes') ?? ''));
  if (!id) redirect('/admin/leads');

  await updateLead(id, {
    ...((LEAD_STATUSES as readonly string[]).includes(status)
      ? { status: status as LeadStatus }
      : {}),
    notes,
  });
  redirect('/admin/leads?saved=1');
}

export async function removeLead(formData: FormData): Promise<void> {
  await requireSession();
  const id = sanitizeText(String(formData.get('id') ?? ''));
  if (id) await deleteLead(id);
  redirect('/admin/leads');
}
