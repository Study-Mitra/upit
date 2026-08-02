/**
 * Generic extractor for every family except `course` (which has its own
 * structured extractor).
 *
 * Captures the whole content region as `contentHtml`, plus SEO. This is the
 * fastest route to every page rendering pixel-perfect from MongoDB, which is the
 * stated priority; the admin-editable families (university, blog,
 * specialization) get field-level structure layered on in the admin phase, using
 * the same shell-vs-blob split already proven on `course`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { extractContent } from '../gen-page.mjs';
import { stripOrigin } from '../lib/html-to-jsx.mjs';
import { extractSeo } from './course.mjs';

const RAW = new URL('../../data/raw/', import.meta.url);

/** Rewrite absolute live-origin URLs across a whole HTML fragment. */
function cleanFragment(html) {
  const $ = load(html, null, false);
  $('*').each((_, el) => {
    const attribs = el.attribs ?? {};
    for (const [k, v] of Object.entries(attribs)) {
      if (typeof v === 'string' && v.includes('srmflexilearn.com')) {
        $(el).attr(k, stripOrigin(v));
      }
    }
  });
  return $.html();
}

export async function extractGenericPage(file, path, family) {
  const $ = load(await readFile(new URL(file, RAW), 'utf8'));
  const { html } = extractContent($);

  // Breadcrumb title, where the template has one — useful metadata for the
  // admin even while the body is stored as a blob.
  const name =
    $('.rbt-breadcrumb-default h4.title').first().text().replace(/\s+/g, ' ').trim() ||
    $('.breadcrumb-inner h4.title').first().text().replace(/\s+/g, ' ').trim() ||
    '';

  const segments = path.split('/').filter(Boolean);

  return {
    slug: path, // path is the natural key for this collection
    path,
    family,
    name,
    contentHtml: cleanFragment(html),
    seo: extractSeo($),
    // Convenience for routes that need the last segment.
    segment: segments.length > 1 ? segments.slice(1).join('/') : (segments[0] ?? ''),
  };
}

async function main() {
  const inventory = JSON.parse(
    await readFile(new URL('../../data/inventory.json', import.meta.url), 'utf8')
  );

  const out = [];
  const failures = [];
  for (const page of inventory.pages) {
    if (page.family === 'course') continue; // structured extractor owns these
    try {
      out.push(await extractGenericPage(page.file, page.path, page.family));
    } catch (err) {
      failures.push({ path: page.path, error: err.message });
    }
  }

  await writeFile(
    new URL('../../data/extracted/pages.json', import.meta.url),
    JSON.stringify(out, null, 2)
  );

  const byFamily = {};
  for (const p of out) byFamily[p.family] = (byFamily[p.family] ?? 0) + 1;
  console.log(`extracted ${out.length} pages`);
  console.table(byFamily);
  if (failures.length) console.log('failures:', failures);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
