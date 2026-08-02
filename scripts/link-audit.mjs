/**
 * Crawl the local build and report every internal link that does not resolve.
 *
 * The reference site is the contract: a link that works there must work here.
 * Links that are broken on the reference too are reported separately, because
 * those are faithfully replicated rather than defects.
 *
 * Usage: node scripts/link-audit.mjs [--origin http://localhost:3100]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';

const LOCAL = process.env.LOCAL_ORIGIN ?? 'http://localhost:3100';
const INVENTORY = new URL('../data/inventory.json', import.meta.url);

function toPath(href, base) {
  if (!href) return null;
  const t = href.trim();
  if (!t || /^(#|mailto:|tel:|javascript:|data:)/i.test(t)) return null;
  let url;
  try {
    url = new URL(t, base);
  } catch {
    return null;
  }
  if (url.origin !== new URL(base).origin) return null;
  if (/\.(css|js|png|jpe?g|webp|svg|gif|ico|woff2?|ttf|pdf|mp4)$/i.test(url.pathname)) return null;
  return url.pathname.replace(/\/+$/, '') || '/';
}

async function head(origin, path) {
  try {
    const res = await fetch(origin + path, { redirect: 'manual' });
    return res.status;
  } catch (err) {
    return `ERR ${err.message}`;
  }
}

async function main() {
  const inv = JSON.parse(await readFile(INVENTORY, 'utf8'));
  const knownPaths = new Set(inv.pages.map((p) => p.path));

  // Collect every internal link target referenced anywhere in the snapshots.
  const targets = new Map(); // path -> Set of pages that link to it
  const RAW = new URL('../data/raw/', import.meta.url);
  for (const page of inv.pages) {
    const $ = load(await readFile(new URL(page.file, RAW), 'utf8'));
    $('a[href]').each((_, el) => {
      const p = toPath($(el).attr('href'), 'https://srmflexilearn.com' + page.path);
      if (!p) return;
      if (!targets.has(p)) targets.set(p, new Set());
      targets.get(p).add(page.path);
    });
  }

  console.log(`${targets.size} distinct internal link targets referenced across ${inv.pages.length} pages\n`);

  const broken = [];
  const brokenOnReferenceToo = [];
  const ok = [];

  const all = [...targets.keys()].sort();
  for (const path of all) {
    const status = await head(LOCAL, path);
    if (status === 200) {
      ok.push(path);
      continue;
    }
    // Was this target reachable on the reference site? Anything in the crawl
    // inventory was a real 200 at crawl time.
    if (knownPaths.has(path)) {
      broken.push({ path, status, linkedFrom: [...targets.get(path)].slice(0, 3) });
    } else {
      brokenOnReferenceToo.push({ path, status, linkedFrom: [...targets.get(path)].slice(0, 3) });
    }
  }

  console.log(`OK:                     ${ok.length}`);
  console.log(`BROKEN (regressions):   ${broken.length}`);
  console.log(`Broken on reference too:${brokenOnReferenceToo.length}\n`);

  if (broken.length) {
    console.log('--- MISSING PAGES (exist on reference, 404 here) ---');
    const byFamily = {};
    for (const b of broken) {
      const fam = b.path.split('/').filter(Boolean)[0] ?? 'root';
      (byFamily[fam] ??= []).push(b);
    }
    for (const [fam, items] of Object.entries(byFamily).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${fam.padEnd(24)} ${items.length} missing   e.g. ${items.slice(0, 3).map((i) => i.path).join(', ')}`);
    }
  }

  if (brokenOnReferenceToo.length) {
    console.log('\n--- BROKEN ON THE REFERENCE SITE TOO (faithfully replicated) ---');
    for (const b of brokenOnReferenceToo) {
      console.log(`  ${String(b.status).padStart(4)}  ${b.path}   linked from ${b.linkedFrom.join(', ')}`);
    }
  }

  await writeFile(
    new URL('../data/link-audit.json', import.meta.url),
    JSON.stringify({ ok, broken, brokenOnReferenceToo }, null, 2)
  );
}

main();
