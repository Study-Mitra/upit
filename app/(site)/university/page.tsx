import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PageScripts from '@/components/PageScripts';
import RawContent from '@/components/templates/RawContent';
import { getPage } from '@/lib/models/pages';
import { getUniversities } from '@/lib/models/universities';
import { renderUniversityCard } from '@/lib/admin/card';

const PATH = '/university';

/**
 * The listing's cards come from the database; its filter sidebar does not.
 *
 * Only `#university-list` was ever data here — the surrounding 51KB is the course
 * tree, price bands and study-mode filters whose markup the page's own scripts
 * bind to by id. scripts/prepare-listing-template.mjs replaced the 19 hardcoded
 * cards with a `@@CARDS@@` marker and kept everything else verbatim; the cards are
 * rendered into that slot here, which is what makes a newly added college appear.
 *
 * Cards are produced by the same `renderUniversityCard` the admin uses on save, so
 * the server-rendered listing and the AJAX filter responses are identical markup.
 */
const CARD_MARKER = '@@CARDS@@';

/**
 * The "We found N universities" figure is hardcoded in the imported markup.
 *
 * The page's filter scripts overwrite `#university_count` after every AJAX call,
 * so it self-corrects the moment you touch a filter — but on first paint it would
 * show the imported 19 regardless of how many colleges actually exist, which is
 * visibly wrong as soon as one is added or removed.
 */
function withCount(html: string, count: number): string {
  return html.replace(
    /(<span[^>]*id="university_count"[^>]*>)[\s\S]*?(<\/span>)/i,
    `$1${count}$2`
  );
}

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage(PATH);
  if (!page) return {};
  return { title: page.seo.title, description: page.seo.description, keywords: page.seo.keywords };
}

export default async function Page() {
  const [page, universities] = await Promise.all([getPage(PATH), getUniversities()]);
  if (!page) notFound();

  const cards = universities.map((u) => u.cardHtml || renderUniversityCard(u)).join('\n');

  // If the marker is missing the page has not been templated yet; render it
  // unchanged rather than silently dropping the listing.
  const html = withCount(
    page.contentHtml.includes(CARD_MARKER)
      ? page.contentHtml.replace(CARD_MARKER, cards)
      : page.contentHtml,
    universities.length
  );

  return (
    <>
      <PageScripts path={page.path} />
      <RawContent html={html} />
    </>
  );
}
