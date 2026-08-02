import { getDb } from '@/lib/mongodb';
import { escapeHtml } from '@/lib/html';

/**
 * Site search.
 *
 * Returns an HTML FRAGMENT, not JSON — the client does
 * `$('#resultDiv').html(data)` (public/assets/js/inline/inline-10.js), so the
 * markup shape below is the contract. It was captured from the reference
 * endpoint's response for ?search_val=mba.
 *
 * Note the parameter is `search_val`. The site's own JSON-LD advertises
 * `?query=`, which is wrong and never used; that is corrected separately.
 */
type Hit = { href: string; title: string; label: string; icon: string };

function renderHit(hit: Hit): string {
  return `    <a href="${escapeHtml(hit.href)}" class="d-flex align-items-center justify-content-start w-100 px-2 py-2 border-bottom">
        <p class="lh-1 fw-semibold mb-0 ${hit.icon} me-2"> </p>
        <div class="ms-2">
            <p class="mb-0 lh-1 fw-semibold">${escapeHtml(hit.title)}</p>
            <span class="lh-1 fs-12 text-primary">${escapeHtml(hit.label)}</span>
        </div>
    </a>
`;
}

/** Escape a user-supplied string for safe use inside a RegExp. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const term = (url.searchParams.get('search_val') ?? '').trim();

  if (!term) {
    return new Response('', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const db = await getDb();
  const rx = new RegExp(escapeRegex(term), 'i');
  const hits: Hit[] = [];

  // Blogs first, then courses, then universities — matching the reference order.
  const blogs = await db
    .collection('pages')
    .find({ family: 'blog', name: rx }, { projection: { _id: 0, path: 1, name: 1, seo: 1 } })
    .limit(5)
    .toArray();
  for (const b of blogs) {
    if (b.path === '/blog') continue;
    hits.push({ href: b.path, title: b.name || b.seo?.title || b.path, label: 'Blog', icon: 'fa fa-blog' });
  }

  const courses = await db
    .collection('courses')
    .find({ name: rx, kind: 'detail' }, { projection: { _id: 0, path: 1, name: 1 } })
    .limit(8)
    .toArray();
  for (const c of courses) {
    hits.push({ href: c.path, title: c.name, label: 'Course', icon: 'fa fa-book' });
  }

  const unis = await db
    .collection('universities')
    .find({ name: rx }, { projection: { _id: 0, path: 1, name: 1 } })
    .limit(5)
    .toArray();
  for (const u of unis) {
    hits.push({ href: u.path, title: u.name, label: 'University', icon: 'fa fa-university' });
  }

  const body = hits.length
    ? `<div class="card-body p-0 resultCard">\n${hits.map(renderHit).join('')}</div>`
    : '<div class="card-body p-0 resultCard"><p class="mb-0 px-2 py-2">No results found.</p></div>';

  return new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
