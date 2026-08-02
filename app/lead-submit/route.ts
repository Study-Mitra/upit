import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

/**
 * Replaces the Laravel endpoint at the SAME path, so the site's own inline
 * JavaScript (public/assets/js/inline/inline-06.js) needs no modification.
 *
 * Contract, taken from that script:
 *   success -> { status: '200' }   — a STRING, compared with ===
 *   failure -> HTTP 422 { errors: { field: [msg] } }; the client maps each key
 *              to `#${key}_apply_now` and shows the message in a sibling.
 */
const FIELDS = ['name', 'contact', 'email', 'source', 'state', 'course'] as const;

function validate(data: Record<string, string>): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (!data.name?.trim()) {
    errors.name = ['The name field is required.'];
  }
  if (!data.contact?.trim()) {
    errors.contact = ['The contact field is required.'];
  } else if (!/^[0-9+\-\s]{7,15}$/.test(data.contact.trim())) {
    errors.contact = ['The contact must be a valid phone number.'];
  }
  if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email.trim())) {
    errors.email = ['The email must be a valid email address.'];
  }
  return errors;
}

export async function POST(request: Request) {
  // Laravel's CSRF token is gone (blanked in the inline script). An origin check
  // is the equivalent protection for a same-site form post.
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ message: 'Invalid origin' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ message: 'Invalid origin' }, { status: 403 });
    }
  }

  let data: Record<string, string> = {};
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    data = (await request.json()) as Record<string, string>;
  } else {
    const form = await request.formData();
    for (const [k, v] of form.entries()) data[k] = String(v);
  }

  const errors = validate(data);
  if (Object.keys(errors).length) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  const db = await getDb();
  await db.collection('leads').insertOne({
    ...Object.fromEntries(FIELDS.map((f) => [f, data[f] ?? ''])),
    status: 'new',
    notes: '',
    userAgent: request.headers.get('user-agent') ?? '',
    createdAt: new Date(),
  });

  return NextResponse.json({ status: '200' });
}
