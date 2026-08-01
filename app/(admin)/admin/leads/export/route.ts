import { getSession } from '@/lib/admin/auth';
import { getLeads } from '@/lib/models/leads';

/**
 * CSV export of the enquiry list.
 *
 * A route handler rather than a Server Action: this returns a file download, and
 * an action can only return data or redirect. Honours the same ?status= and ?q=
 * filters as the list, so what you see is what you export.
 */
const COLUMNS = [
  'createdAt',
  'name',
  'contact',
  'email',
  'course',
  'state',
  'source',
  'status',
  'notes',
] as const;

/**
 * Quote every field.
 *
 * A leading =, +, - or @ is prefixed with a single quote: spreadsheet software
 * treats such a value as a formula, which turns a hostile lead submission into
 * code execution when someone opens the export.
 */
function csvCell(value: string): string {
  const raw = String(value ?? '');
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const leads = await getLeads({
    status: url.searchParams.get('status') ?? 'all',
    q: url.searchParams.get('q') ?? '',
  });

  const rows = [
    COLUMNS.join(','),
    ...leads.map((l) => COLUMNS.map((c) => csvCell(String(l[c] ?? ''))).join(',')),
  ];

  // BOM so Excel reads it as UTF-8 rather than mangling non-ASCII names.
  const body = `﻿${rows.join('\r\n')}\r\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
