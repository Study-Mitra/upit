/**
 * Phase 2a — polite BFS crawl of every public page on srmflexilearn.com.
 *
 * Writes raw HTML to data/raw/<safe>.html and an inventory to data/inventory.json.
 * The inventory is the source of truth for later phases; do NOT hardcode page lists
 * elsewhere. Recon established 164 pages as a verified FLOOR, not a ceiling
 * (/courses/pg-courses was orphaned and only found by probing), so this crawl also
 * probes a candidate list and logs anything new.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { load } from 'cheerio';
import { ORIGIN, UA, DELAY_MS, safeName, sleep } from './lib/common.mjs';

const RAW_DIR = new URL('../data/raw/', import.meta.url);
const DATA_DIR = new URL('../data/', import.meta.url);

// Auth scaffold — explicitly out of scope per the approved plan.
const EXCLUDE = new Set(['/login', '/register']);

const SEEDS = [
  '/', '/about', '/contact', '/blog', '/course', '/university', '/gallery',
  '/compare-university', '/privacy-policy', '/terms-condition',
  '/courses/ug-courses', '/courses/pg-courses', '/courses/phd',
];

// Orphan hunt: paths not reachable from the link graph. Recorded only if they 200.
const PROBES = [
  '/courses/pg-courses', '/course/online', '/course/regular',
];

const ROUTE_FAMILIES = [
  'course', 'courses', 'university', 'specialization',
  'specialization-details', 'blog', 'compare',
];

/** Normalise an href into a same-origin absolute path, or null if external/non-page. */
function toPath(href, base) {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed || /^(#|mailto:|tel:|javascript:|data:)/i.test(trimmed)) return null;
  let url;
  try {
    url = new URL(trimmed, base);
  } catch {
    return null;
  }
  if (url.origin !== ORIGIN) return null;
  // Skip anything that is an asset rather than a page.
  if (/\.(css|js|png|jpe?g|webp|svg|gif|ico|woff2?|ttf|eot|pdf|mp4|webm)$/i.test(url.pathname)) return null;
  return url.pathname.replace(/\/+$/, '') || '/';
}

async function fetchPage(path) {
  const res = await fetch(ORIGIN + path, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'manual',
    signal: AbortSignal.timeout(45_000),
  });
  const status = res.status;
  // /course 302-redirects to /course/online; follow it so the family is discovered.
  if (status >= 300 && status < 400) {
    return { status, redirect: res.headers.get('location'), html: null };
  }
  const html = await res.text();
  return { status, redirect: null, html };
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });

  const queue = [...SEEDS];
  const seen = new Set(queue);
  const pages = [];
  const failures = [];
  const redirects = [];

  while (queue.length) {
    const path = queue.shift();
    if (EXCLUDE.has(path)) continue;

    let result;
    try {
      result = await fetchPage(path);
    } catch (err) {
      failures.push({ path, error: String(err) });
      console.error(`  ERR  ${path} — ${err.message}`);
      await sleep(DELAY_MS);
      continue;
    }

    if (result.redirect) {
      const target = toPath(result.redirect, ORIGIN + path);
      redirects.push({ from: path, to: target });
      if (target && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
      console.log(`  ${result.status}  ${path} -> ${target}`);
      await sleep(DELAY_MS);
      continue;
    }

    if (result.status !== 200) {
      failures.push({ path, status: result.status });
      console.error(`  ${result.status}  ${path}`);
      await sleep(DELAY_MS);
      continue;
    }

    const $ = load(result.html);
    const title = $('title').first().text().trim();
    const file = `${safeName(path)}.html`;
    await writeFile(new URL(file, RAW_DIR), result.html, 'utf8');

    const segments = path.split('/').filter(Boolean);
    pages.push({
      path,
      file,
      title,
      bytes: Buffer.byteLength(result.html),
      family: segments.length ? segments[0] : 'root',
    });
    console.log(`  200  ${path}  (${pages.length})`);

    // Enqueue newly discovered same-origin pages.
    for (const el of $('a[href]').toArray()) {
      const next = toPath($(el).attr('href'), ORIGIN + path);
      if (!next || seen.has(next) || EXCLUDE.has(next)) continue;
      const head = next.split('/').filter(Boolean)[0];
      // Only follow known page families plus top-level standalone pages.
      const isStandalone = next.split('/').filter(Boolean).length <= 1;
      if (!isStandalone && !ROUTE_FAMILIES.includes(head)) continue;
      seen.add(next);
      queue.push(next);
    }

    await sleep(DELAY_MS);
  }

  // Orphan probe — anything 200 that the link graph never surfaced.
  const orphans = [];
  for (const path of PROBES) {
    if (seen.has(path)) continue;
    try {
      const { status, html } = await fetchPage(path);
      if (status === 200 && html) {
        const $ = load(html);
        const file = `${safeName(path)}.html`;
        await writeFile(new URL(file, RAW_DIR), html, 'utf8');
        const entry = {
          path, file,
          title: $('title').first().text().trim(),
          bytes: Buffer.byteLength(html),
          family: path.split('/').filter(Boolean)[0],
          orphan: true,
        };
        pages.push(entry);
        orphans.push(path);
        console.log(`  200  ${path}  (ORPHAN)`);
      }
    } catch { /* probe failures are not fatal */ }
    await sleep(DELAY_MS);
  }

  pages.sort((a, b) => a.path.localeCompare(b.path));

  const byFamily = {};
  for (const p of pages) byFamily[p.family] = (byFamily[p.family] ?? 0) + 1;

  const inventory = {
    crawledAt: new Date().toISOString(),
    origin: ORIGIN,
    total: pages.length,
    byFamily,
    orphans,
    redirects,
    failures,
    pages,
  };
  await writeFile(new URL('inventory.json', DATA_DIR), JSON.stringify(inventory, null, 2));

  console.log('\n--- crawl complete ---');
  console.log(`pages: ${pages.length}`);
  console.table(byFamily);
  if (orphans.length) console.log('orphans:', orphans);
  if (failures.length) console.log(`failures: ${failures.length}`, failures.slice(0, 10));
}

main();
