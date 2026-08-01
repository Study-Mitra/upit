import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * Enquiry submissions from the site's lead forms (see app/lead-submit/route.ts).
 *
 * `status` and `notes` were written by that endpoint from the start and never
 * read — admin.css even ships `.a-badge-new`/`-contacted`/`-closed` for them. The
 * admin is where they finally become useful.
 */
export const LEAD_STATUSES = ['new', 'contacted', 'closed'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type Lead = {
  id: string;
  name: string;
  contact: string;
  email: string;
  source: string;
  state: string;
  course: string;
  status: LeadStatus;
  notes: string;
  userAgent: string;
  createdAt: string;
};

const COLLECTION = 'leads';

/** Mongo `_id` may be an ObjectId or a string depending on how it was inserted. */
function idFilter(id: string) {
  if (ObjectId.isValid(id) && String(new ObjectId(id)) === id) {
    return { $or: [{ _id: new ObjectId(id) }, { _id: id as unknown as ObjectId }] };
  }
  return { _id: id as unknown as ObjectId };
}

function shape(doc: Record<string, unknown>): Lead {
  const created = doc.createdAt;
  return {
    id: String(doc._id),
    name: String(doc.name ?? ''),
    contact: String(doc.contact ?? ''),
    email: String(doc.email ?? ''),
    source: String(doc.source ?? ''),
    state: String(doc.state ?? ''),
    course: String(doc.course ?? ''),
    status: (LEAD_STATUSES as readonly string[]).includes(String(doc.status))
      ? (String(doc.status) as LeadStatus)
      : 'new',
    notes: String(doc.notes ?? ''),
    userAgent: String(doc.userAgent ?? ''),
    createdAt:
      created instanceof Date
        ? created.toISOString()
        : String(created ?? ''),
  };
}

export async function getLeads(filter: { status?: string; q?: string } = {}): Promise<Lead[]> {
  const db = await getDb();
  const query: Record<string, unknown> = {};
  if (filter.status && filter.status !== 'all') query.status = filter.status;
  if (filter.q) {
    // Escaped: a lead search box must not let a stray "(" throw a regex error.
    const safe = filter.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = { $regex: safe, $options: 'i' };
    query.$or = [{ name: rx }, { email: rx }, { contact: rx }, { course: rx }, { state: rx }];
  }
  const docs = await db.collection(COLLECTION).find(query).sort({ createdAt: -1 }).toArray();
  return docs.map((d) => shape(d as Record<string, unknown>));
}

export async function updateLead(
  id: string,
  patch: { status?: LeadStatus; notes?: string }
): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).updateOne(idFilter(id), { $set: patch });
}

export async function deleteLead(id: string): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTION).deleteOne(idFilter(id));
}
