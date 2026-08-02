/**
 * Extract the 49 /course/* pages into structured documents.
 *
 * Model established by scripts/analyze-template.mjs plus DOM inspection:
 * the page is a thin structured shell around ONE free-form WYSIWYG blob. The
 * blob's internal shape varies wildly between courses (mba-regular uses
 * .course-detail-section wrappers, phd-in-nursing uses bare h3/h4), which
 * confirms it is editor output rather than structured fields. Storing it as
 * `descriptionHtml` is both faithful and exactly what the admin's rich-text
 * editor will edit.
 *
 * The two listing pages (/course/online, /course/regular) and /course/test have
 * different section signatures and are handled separately by `kind`.
 */
import { readFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { stripOrigin } from '../lib/html-to-jsx.mjs';

const RAW = new URL('../../data/raw/', import.meta.url);

/** Pull the SEO block out of <head>. */
export function extractSeo($) {
  return {
    title: $('head title').first().text().trim(),
    description: $('head meta[name="description"]').attr('content') ?? '',
    keywords: $('head meta[name="keywords"]').attr('content') ?? '',
  };
}

/** Rewrite every absolute live-origin URL inside an HTML fragment. */
function cleanHtml($, el) {
  if (!el || !el.length) return '';
  const $c = load($.html(el), null, false);
  $c('[src],[href],[data-logo],[data-url],[action],[poster]').each((_, node) => {
    for (const attr of ['src', 'href', 'data-logo', 'data-url', 'action', 'poster']) {
      const v = $c(node).attr(attr);
      if (v) $c(node).attr(attr, stripOrigin(v));
    }
  });
  return $c.html();
}

/** Sidebar detail rows: Eligibility / Duration / Fees / Universities. */
function extractDetails($) {
  const rows = [];
  $('.rbt-widget-details .rbt-course-details-list-wrapper > li').each((_, li) => {
    const $li = $(li);
    const $label = $li.children('span').first();
    const icon = $label.find('i').attr('class') ?? '';
    const label = $label.text().replace(/\s+/g, ' ').trim();

    // Eligibility renders as a full-width block; the others as a badge span.
    const $block = $li.children('div').first();
    if ($block.length) {
      rows.push({
        icon,
        label,
        value: $block.text().replace(/\s+/g, ' ').trim(),
        style: 'block',
      });
    } else {
      const $val = $li.children('span').eq(1);
      rows.push({
        icon,
        label,
        value: $val.text().replace(/\s+/g, ' ').trim(),
        style: 'badge',
      });
    }
  });
  return rows;
}

/** Optional "Universities Offering X" cards (present on 27 of 49). */
function extractUniversitiesOffering($) {
  const area = $('.rbt-top-course-area').first();
  if (!area.length) return null;

  const cards = [];
  area.find('.rbt-card').each((_, card) => {
    const $c = $(card);
    const href = stripOrigin($c.find('a').first().attr('href') ?? '');
    cards.push({
      slug: href.replace(/^\/university\//, '').replace(/\/$/, ''),
      href,
      name: $c.find('.rbt-card-title a').text().replace(/\s+/g, ' ').trim(),
      logo: stripOrigin($c.find('.rbt-card-img img').attr('src') ?? ''),
      logoAlt: $c.find('.rbt-card-img img').attr('alt') ?? '',
      feeText: $c.find('.rbt-card-text').text().replace(/\s+/g, ' ').trim(),
    });
  });

  return {
    heading: area.find('.section-title, h2, h3, h4').first().text().replace(/\s+/g, ' ').trim(),
    cards,
  };
}

/**
 * @param {string} file  basename in data/raw
 * @param {string} path  live URL path
 */
export async function extractCourse(file, path) {
  const $ = load(await readFile(new URL(file, RAW), 'utf8'));
  const slug = path.replace(/^\/course\//, '');

  const breadcrumb = $('.rbt-breadcrumb-default').first();
  const name = breadcrumb.find('h4.title').first().text().replace(/\s+/g, ' ').trim();

  // Listing pages (/course/online, /course/regular) have no details area.
  const detailsArea = $('.rbt-course-details-area').first();
  const isListing = !detailsArea.length;

  if (isListing) {
    return {
      slug,
      path,
      kind: 'listing',
      name,
      // The tabbed accordion body is preserved wholesale: it is a rendered index
      // of other courses, regenerated from `courses` at render time in Phase B.
      bodyHtml: cleanHtml($, $('.rbt-accordion-area').first()),
      seo: extractSeo($),
    };
  }

  const inner = $('.rbt-course-feature-inner').first();
  const $sectionTitle = inner.children('.section-title').first();
  const aboutHeading = $sectionTitle.text().replace(/\s+/g, ' ').trim();

  // Everything after .section-title is the WYSIWYG blob.
  const bodyNodes = inner.children().toArray().filter((el) => el !== $sectionTitle[0]);
  const descriptionHtml = bodyNodes
    .map((el) => cleanHtml($, $(el)))
    .join('\n');

  return {
    slug,
    path,
    kind: 'detail',
    name,
    aboutHeading,
    bannerImage: stripOrigin(
      $('.course-sidebar .content-item-content .mb-4 img').first().attr('src') ?? ''
    ),
    descriptionHtml,
    details: extractDetails($),
    universitiesOffering: extractUniversitiesOffering($),
    // Optional FAQ accordion. Present on 1 of 49 courses today, but it is a real
    // per-course field, so it is stored rather than special-cased. Kept as raw
    // HTML: the accordion's ids, aria-controls and data-bs-parent are
    // interdependent, and regenerating them risks breaking the collapse wiring.
    faqHtml: cleanHtml($, $('.rbt-accordion-area').first()) || null,
    seo: extractSeo($),
  };
}
