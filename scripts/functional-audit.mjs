/**
 * Functional audit: load every page in a real browser and report anything
 * broken that a screenshot diff cannot see.
 *
 * Checks per page:
 *   - uncaught JS errors, compared against the same page on the reference
 *   - failed network requests (404s for assets or XHR endpoints)
 *   - whether the expected global objects initialised
 *
 * Errors present on the reference too are reported separately — those are
 * faithfully replicated, not defects.
 *
 * Usage: node scripts/functional-audit.mjs [--all]
 *        (default: one representative page per family)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const LOCAL = process.env.LOCAL_ORIGIN ?? 'http://localhost:3100';
const REFERENCE = process.env.REFERENCE_ORIGIN ?? 'http://localhost:3200';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function inspect(context, url) {
  const page = await context.newPage();
  const errors = new Set();
  const failed = new Set();

  page.on('pageerror', (e) => errors.add(e.message.split('\n')[0].slice(0, 140)));
  page.on('response', (r) => {
    if (r.status() >= 400) failed.add(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  page.on('requestfailed', (r) => {
    failed.add(`ERR ${new URL(r.url()).pathname} :: ${r.failure()?.errorText ?? ''}`);
  });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
  } catch (err) {
    errors.add(`NAVIGATION: ${err.message.slice(0, 100)}`);
  }
  await page.waitForTimeout(6000);

  const globals = await page
    .evaluate(() => ({
      jQuery: typeof window.jQuery,
      Swiper: typeof window.Swiper,
      swiperInstances: document.querySelectorAll('.swiper').length
        ? [...document.querySelectorAll('.swiper')].filter((e) => e.swiper).length
        : 0,
      swiperElements: document.querySelectorAll('.swiper').length,
      bootstrap: typeof window.bootstrap,
      Swal: typeof window.Swal,
    }))
    .catch(() => ({}));

  await page.close();
  return { errors: [...errors], failed: [...failed], globals };
}

async function main() {
  const all = process.argv.includes('--all');
  const inv = JSON.parse(await readFile(new URL('../data/inventory.json', import.meta.url), 'utf8'));

  let paths;
  if (all) {
    paths = inv.pages.map((p) => p.path);
  } else {
    const seen = new Set();
    paths = [];
    for (const p of inv.pages) {
      if (seen.has(p.family)) continue;
      seen.add(p.family);
      paths.push(p.path);
    }
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 } });

  const report = [];
  for (const path of paths) {
    const [local, ref] = await Promise.all([
      inspect(context, LOCAL + path),
      inspect(context, REFERENCE + path),
    ]);

    const newErrors = local.errors.filter((e) => !ref.errors.includes(e));
    const fixedErrors = ref.errors.filter((e) => !local.errors.includes(e));
    const newFailed = local.failed.filter((f) => !ref.failed.includes(f));

    const status = newErrors.length || newFailed.length ? 'ISSUES' : 'ok';
    console.log(`  ${status === 'ok' ? ' ok ' : 'FAIL'}  ${path.padEnd(46)} swipers ${local.globals.swiperInstances}/${local.globals.swiperElements} (ref ${ref.globals.swiperInstances}/${ref.globals.swiperElements})`);
    for (const e of newErrors) console.log(`          NEW ERROR   ${e}`);
    for (const f of newFailed) console.log(`          NEW FAILED  ${f}`);
    if (local.globals.swiperInstances !== ref.globals.swiperInstances) {
      console.log(`          SWIPER MISMATCH: local ${local.globals.swiperInstances}, reference ${ref.globals.swiperInstances}`);
    }

    report.push({ path, local, ref, newErrors, fixedErrors, newFailed });
  }

  await browser.close();
  await writeFile(
    new URL('../data/functional-audit.json', import.meta.url),
    JSON.stringify(report, null, 2)
  );

  const bad = report.filter((r) => r.newErrors.length || r.newFailed.length);
  console.log(`\n${report.length - bad.length}/${report.length} pages clean`);
}

main();
