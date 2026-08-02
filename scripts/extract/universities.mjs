/**
 * Extract the 19 universities as structured records.
 *
 * Needed for two things beyond the page render:
 *   - /compare-list maps the numeric `data-id` on .compare-uni buttons to slugs,
 *     so that mapping must exist in the database.
 *   - /getSearchResults searches universities by name.
 * Both are also the backbone of the admin's university screens.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { stripOrigin } from '../lib/html-to-jsx.mjs';
import { extractSeo } from './course.mjs';

const RAW = new URL('../../data/raw/', import.meta.url);

export async function extractUniversities() {
  const $ = load(await readFile(new URL('university.html', RAW), 'utf8'));
  const out = [];

  $('#university-list .rbt-card').each((_, card) => {
    const $c = $(card);
    const $cmp = $c.find('.compare-uni').first();
    const href = stripOrigin(
      $c.find('a[href*="/university/"]').first().attr('href') ?? ''
    );
    const slug = href.replace(/^\/university\//, '').replace(/\/$/, '');
    if (!slug) return;

    // Rewrite the card's own absolute URLs before storing it.
    const $card = load($.html($c), null, false);
    $card('[src],[href],[data-url],[data-logo]').each((__, node) => {
      for (const attr of ['src', 'href', 'data-url', 'data-logo']) {
        const v = $card(node).attr(attr);
        if (v) $card(node).attr(attr, stripOrigin(v));
      }
    });

    out.push({
      slug,
      path: `/university/${slug}`,
      name: $c.find('.rbt-card-title').text().replace(/\s+/g, ' ').trim(),
      // The compare endpoints key off this numeric id, not the slug.
      compareId: $cmp.attr('data-id') ?? null,
      compareName: $cmp.attr('data-name') ?? null,
      logo: stripOrigin($cmp.attr('data-logo') ?? ''),
      location: $c.find('.uni-meta span').first().text().replace(/\s+/g, ' ').trim(),
      badges: $c
        .find('.srm-approval-badge')
        .map((__, b) => $(b).text().replace(/\s+/g, ' ').trim())
        .get()
        .filter(Boolean),
      excerpt: $c.find('.rbt-card-text').first().text().replace(/\s+/g, ' ').trim().slice(0, 400),
      // Filter keys, read straight off the card. The /filter-* endpoints match
      // on these, exactly as the reference does.
      elementId: $c.attr('id') ?? null,
      courseIds: ($c.attr('data-courses') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      modeIds: ($c.attr('data-modes') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      // The card's exact markup, so the filter endpoints can return the same
      // HTML the reference returns rather than a recreation of it.
      cardHtml: $card.html(),
    });
  });

  // Merge in each university's own detail page for SEO + banner.
  for (const uni of out) {
    try {
      const file = `university__${uni.slug}.html`;
      const $d = load(await readFile(new URL(file, RAW), 'utf8'));
      uni.seo = extractSeo($d);
      uni.detailName = $d('.rbt-breadcrumb-default h4.title').first().text().replace(/\s+/g, ' ').trim();
    } catch {
      uni.seo = { title: '', description: '', keywords: '' };
    }
  }

  return out;
}

async function main() {
  const unis = await extractUniversities();
  await writeFile(
    new URL('../../data/extracted/universities.json', import.meta.url),
    JSON.stringify(unis, null, 2)
  );
  console.log(`extracted ${unis.length} universities`);
  console.log(`  with compareId: ${unis.filter((u) => u.compareId).length}`);
  console.log(`  with logo:      ${unis.filter((u) => u.logo).length}`);
  for (const u of unis.slice(0, 5)) {
    console.log(`  id=${String(u.compareId).padStart(3)}  ${u.slug.padEnd(42)} ${u.name}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
