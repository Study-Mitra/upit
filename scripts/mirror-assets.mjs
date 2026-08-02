/**
 * Phase 0 — mirror every static asset verbatim into public/.
 *
 * Paths are preserved exactly so that styles.css's relative url(../images/...)
 * references resolve unchanged. Assets are collected from ALL 162 crawled pages
 * (not just the homepage) plus recursively from every stylesheet's url()/@import.
 *
 * Deliberately NOT mirrored (approved plan, "drop dead weight"):
 *   - jodit.min.{js,css}  — rich-text editor, never used on any public page
 *   - CDN assets (FontAwesome 6, sweetalert2, glightbox) stay on their CDNs,
 *     exactly as the live site loads them.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { ORIGIN, UA, sleep } from './lib/common.mjs';

const RAW_DIR = new URL('../data/raw/', import.meta.url);
const PUBLIC_DIR = new URL('../public/', import.meta.url);

const SKIP = [/jodit\.min\.(js|css)/i];

/** Extract url(...) targets from a CSS source string. */
function cssUrls(css) {
  const out = [];
  for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    const raw = m[2].trim();
    if (!raw || raw.startsWith('data:') || raw.startsWith('#')) continue;
    out.push(raw);
  }
  for (const m of css.matchAll(/@import\s+url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    out.push(m[2].trim());
  }
  return out;
}

/**
 * Resolve a reference to a same-origin pathname.
 * `base` is the absolute URL the reference appeared in, so relative paths
 * (e.g. styles.css's `../images/x.png`) resolve correctly.
 */
function resolvePath(ref, base) {
  if (!ref) return null;
  const trimmed = ref.trim().replace(/^\.\//, '');
  if (!trimmed || /^(data:|#|mailto:|tel:|javascript:)/i.test(trimmed)) return null;
  let url;
  try {
    url = new URL(trimmed, base);
  } catch {
    return null;
  }
  if (url.origin !== ORIGIN) return null;
  // Strip cache-busting query strings (?=4) — the file on disk is the same.
  return decodeURIComponent(url.pathname);
}

async function main() {
  const files = (await readdir(RAW_DIR)).filter((f) => f.endsWith('.html'));

  /** @type {Set<string>} pathnames still to download */
  const pending = new Set();
  const seen = new Set();

  // --- 1. Harvest asset references from every crawled page -------------------
  for (const file of files) {
    const html = await readFile(new URL(file, RAW_DIR), 'utf8');
    const $ = load(html);
    // The page's own URL, needed to resolve leading-slash-less refs such as
    // src="assets/images/icons/card-icon-1.png" (live site: only works at /).
    const pagePath = file === 'index.html' ? '/' : '/' + file.replace(/\.html$/, '').replace(/__/g, '/');
    const base = ORIGIN + pagePath;

    const push = (ref) => {
      const p = resolvePath(ref, base);
      if (p && !seen.has(p)) pending.add(p);
    };

    $('link[href]').each((_, el) => {
      const rel = ($(el).attr('rel') || '').toLowerCase();
      if (rel.includes('stylesheet') || rel.includes('icon')) push($(el).attr('href'));
    });
    $('script[src]').each((_, el) => push($(el).attr('src')));
    $('img[src]').each((_, el) => push($(el).attr('src')));
    $('img[data-src]').each((_, el) => push($(el).attr('data-src')));
    $('source[src]').each((_, el) => push($(el).attr('src')));
    $('video[poster]').each((_, el) => push($(el).attr('poster')));
    $('[srcset]').each((_, el) => {
      for (const part of ($(el).attr('srcset') || '').split(',')) push(part.trim().split(/\s+/)[0]);
    });
    // Inline style="" attributes and <style> blocks both carry url() refs.
    $('[style]').each((_, el) => cssUrls($(el).attr('style') || '').forEach(push));
    $('style').each((_, el) => cssUrls($(el).html() || '').forEach(push));
  }

  console.log(`harvested ${pending.size} asset refs from ${files.length} pages`);

  // --- 2. Download, following url()/@import inside stylesheets recursively ----
  let ok = 0;
  let failed = 0;
  let bytes = 0;
  const errors = [];

  while (pending.size) {
    const path = pending.values().next().value;
    pending.delete(path);
    if (seen.has(path)) continue;
    seen.add(path);

    if (SKIP.some((re) => re.test(path))) {
      console.log(`  SKIP  ${path}`);
      continue;
    }

    let res;
    try {
      res = await fetch(ORIGIN + encodeURI(path), {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      failed++;
      errors.push({ path, error: err.message });
      continue;
    }

    if (!res.ok) {
      // Note: this host serves the full homepage HTML on 404, so status is the
      // only reliable existence signal.
      failed++;
      errors.push({ path, status: res.status });
      console.log(`  ${res.status}  ${path}`);
      continue;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const dest = new URL('.' + path, PUBLIC_DIR);
    await mkdir(dirname(fileURLToPath(dest)), { recursive: true });
    await writeFile(dest, buf);
    ok++;
    bytes += buf.length;

    // Stylesheets reference further assets; queue them relative to the CSS file.
    if (/\.css$/i.test(path)) {
      const css = buf.toString('utf8');
      for (const ref of cssUrls(css)) {
        const p = resolvePath(ref, ORIGIN + path);
        if (p && !seen.has(p)) pending.add(p);
      }
    }

    await sleep(60);
  }

  const report = { mirroredAt: new Date().toISOString(), ok, failed, bytes, errors };
  await writeFile(new URL('../data/assets-report.json', import.meta.url), JSON.stringify(report, null, 2));

  console.log('\n--- mirror complete ---');
  console.log(`downloaded: ${ok} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`failed: ${failed}`);
  if (errors.length) console.log(errors.slice(0, 20));
}

main();
