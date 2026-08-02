/**
 * Split each college's `pages.contentHtml` blob into structured fields on its
 * `universities` record.
 *
 *   node scripts/migrate-universities.mjs            # dry run, writes nothing
 *   node scripts/migrate-universities.mjs --apply    # write the fields
 *
 * WHY A SPLIT AND NOT A RE-RENDER
 * All 19 pages share the same seven sections, but their internal shape differs
 * (Key Features is a table on one college and a <ul> on another). Copying each
 * section's inner HTML verbatim preserves every page exactly while still giving
 * the admin independently editable fields instead of one 18-103KB blob.
 *
 * WHY CONTAINER IDS AND NOT HEADING TEXT
 * The first attempt split the raw HTML at each <h4>. That is lossless when the
 * fragments are re-concatenated in order, but the fragments are NOT independently
 * renderable: each begins with an orphan </div> closing the heading wrapper and
 * ends part-way into the next section's opening markup. Rendering one on its own
 * breaks the layout.
 *
 * Every section is instead wrapped in `.rbt-course-feature-box` carrying a stable
 * id — overview, coursecontent, details, Features, AdmissionProcess,
 * CareerProspects, Reviews — which the page's own sticky nav already links to.
 * Taking that container's contents minus `.section-title` yields balanced,
 * self-contained HTML.
 *
 * The `pages` documents are NOT deleted. Reverting is then a one-line change to
 * the detail route, and data/raw/*.html remains an independent third copy.
 */
import { MongoClient } from 'mongodb';
import * as cheerio from 'cheerio';

const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const DB = process.env.MONGODB_DB ?? 'upitcollege';
const APPLY = process.argv.includes('--apply');

/**
 * Section container id -> field name.
 *
 * `details` (the Courses carousel) is read but deliberately NOT stored: it is
 * generated from `courseIds`, so persisting it would duplicate derived markup.
 */
const SECTIONS = [
  { id: 'overview', field: 'about' },
  { id: 'coursecontent', field: 'approvalsHtml' },
  { id: 'details', field: null },
  { id: 'Features', field: 'keyFeatures' },
  { id: 'AdmissionProcess', field: 'admissionProcess' },
  { id: 'CareerProspects', field: 'careerProcess' },
  { id: 'Reviews', field: 'reviews' },
];

const KNOWN_IDS = new Set(SECTIONS.map((s) => s.id));

/**
 * Inner HTML of a section box, heading included.
 *
 * The `.section-title` is deliberately KEPT. It sits inside
 * `.rbt-course-feature-inner`, so stripping it would force the template to
 * re-inject a heading into the middle of stored markup — fiddly and easy to get
 * wrong. Keeping it means the template is just the box wrapper plus this string,
 * which is byte-faithful, and the heading becomes editable like any other text
 * (it carries the college name, e.g. "About ARKA JAIN University").
 *
 * The wrapper itself is not stored: every box on every college carries the
 * identical class, so the template supplies it.
 */
function sectionHtml($, id) {
  const box = $(`.rbt-course-feature-box#${id}`).first();
  if (!box.length) return { html: '', found: false };
  return { html: (box.html() ?? '').trim(), found: true };
}

/** div balance; 0 means the fragment stands on its own. */
function balance(html) {
  return (html.match(/<div/g) ?? []).length - (html.match(/<\/div>/g) ?? []).length;
}

/** Hero facts, taken from the breadcrumb block before the first section. */
function parseHero($, name) {
  const hero = $('.rbt-breadcrumb-default').first();
  const logo = hero.find('img.university-logo').attr('src') ?? hero.find('img').eq(0).attr('src') ?? '';
  // The right-hand card holds the banner; fall back to the second image.
  const banner =
    hero.find('.bg-color-white-opacity img').attr('src') ?? hero.find('img').eq(1).attr('src') ?? '';

  let excerpt = '';
  hero.find('p').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t.length > excerpt.length && t.length > 40 && t !== name) excerpt = t;
  });

  return { logo, banner, excerpt };
}

/** Approvals: images from the Approvals box, paired with the badge labels. */
function parseApprovals($, approvalsHtml, badges) {
  const $$ = cheerio.load(`<div>${approvalsHtml || ''}</div>`);
  const logos = $$('img')
    .map((_, el) => $$(el).attr('src'))
    .get()
    .filter(Boolean);

  if (!logos.length) return { approvals: [], warning: 'no approval logos found' };
  if (logos.length !== badges.length) {
    // Positional pairing would mislabel logos, so report instead of guessing.
    return {
      approvals: [],
      warning: `logo/label mismatch: ${logos.length} logos vs ${badges.length} labels`,
    };
  }
  return { approvals: badges.map((label, i) => ({ label, logoUrl: logos[i] })), warning: null };
}

const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 5000 }).connect();
const db = client.db(DB);
const unis = db.collection('universities');
const pages = db.collection('pages');

const all = await unis.find({}, { projection: { _id: 0 } }).toArray();
console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — ${all.length} colleges\n`);

let warnings = 0;
let written = 0;

for (const u of all) {
  const page = await pages.findOne({ path: `/university/${u.slug}` }, { projection: { _id: 0 } });
  if (!page) {
    console.log(`  ${u.slug.padEnd(40)} SKIP — no pages document`);
    warnings++;
    continue;
  }

  const $ = cheerio.load(page.contentHtml);
  const fields = {};
  const notes = [];

  for (const s of SECTIONS) {
    const { html, found } = sectionHtml($, s.id);
    if (!found) notes.push(`missing #${s.id}`);
    if (!s.field) continue;
    fields[s.field] = html;
    if (found && balance(html) !== 0) notes.push(`#${s.id} unbalanced (${balance(html)})`);
  }

  // Any section box with an id we do not know about would otherwise be dropped.
  const extraBoxes = [];
  $('.rbt-course-feature-box').each((_, el) => {
    const id = $(el).attr('id');
    if (!id || !KNOWN_IDS.has(id)) extraBoxes.push(id || '(no id)');
  });

  // Content outside every section box — LPU's FAQ accordion is the only case.
  let faqHtml = '';
  $('h4').each((_, el) => {
    if ($(el).closest('.rbt-course-feature-box').length) return;
    const wrapper = $(el).closest('.rbt-accordion-area, section, div');
    const html = (wrapper.html() ?? '').trim();
    if (html && html.length > faqHtml.length) faqHtml = html;
  });
  if (faqHtml) notes.push(`captured ${faqHtml.length}-char block outside any section (FAQ)`);
  if (extraBoxes.length) notes.push(`unknown boxes: ${extraBoxes.join(',')}`);

  const hero = parseHero($, u.name);
  const { approvals, warning } = parseApprovals($, fields.approvalsHtml, u.badges ?? []);
  if (warning) notes.push(`approvals ${warning}`);
  if (!hero.banner) notes.push('no banner');
  if (!hero.excerpt) notes.push('no excerpt');

  const empty = Object.entries(fields)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (empty.length) notes.push(`empty: ${empty.join(',')}`);
  if (notes.length) warnings++;

  console.log(
    `  ${u.slug.padEnd(40)} appr:${String(approvals.length).padStart(2)}  ` +
      Object.entries(fields)
        .map(([k, v]) => `${k.slice(0, 5)}:${String(v.length).padStart(5)}`)
        .join(' ') +
      (notes.length ? `\n      ↳ ${notes.join('; ')}` : '')
  );

  if (APPLY) {
    await unis.updateOne(
      { slug: u.slug },
      {
        $set: {
          ...fields,
          ...(faqHtml ? { faqHtml } : {}),
          approvals,
          banner: hero.banner,
          // Never clobber a curated excerpt.
          ...(u.excerpt ? {} : { excerpt: hero.excerpt }),
          migratedAt: new Date(),
        },
      }
    );
    written++;
  }
}

console.log(
  `\n${APPLY ? `wrote ${written} colleges` : 'nothing written (dry run)'} — ${warnings} with notes`
);
if (!APPLY) console.log('Re-run with --apply to write.');

await client.close();
