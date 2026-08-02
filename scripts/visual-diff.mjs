/**
 * Visual verification harness — the gate that makes "pixel-perfect" measurable.
 *
 * Loads the same path on the live site and on the local build, settles all
 * scroll-triggered animations identically on both, screenshots each, and reports
 * the percentage of differing pixels.
 *
 * Usage:
 *   node scripts/visual-diff.mjs                      # default page set
 *   node scripts/visual-diff.mjs / /about /contact    # explicit paths
 *   node scripts/visual-diff.mjs --selector header    # diff one element only
 *   node scripts/visual-diff.mjs --viewport 1440      # single viewport
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * Diff target. Defaults to the snapshot server rather than the live site: live
 * reorders its homepage blog cards between requests, so it is not a stable
 * reference. Set REFERENCE_ORIGIN=https://srmflexilearn.com to diff against
 * live deliberately (e.g. to detect content drift).
 */
const LIVE = process.env.REFERENCE_ORIGIN ?? 'http://localhost:3200';
const LOCAL = process.env.LOCAL_ORIGIN ?? 'http://localhost:3000';
const OUT = new URL('../tests/visual/diffs/', import.meta.url);

const VIEWPORTS = [
  { name: '1920', width: 1920, height: 1080 },
  { name: '1440', width: 1440, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
];

/**
 * Above this share of differing pixels a page is a failure.
 * Override with FAIL_THRESHOLD=0 to surface every non-identical page and dump
 * its diff images — useful when chasing sub-threshold residuals.
 */
const FAIL_THRESHOLD = process.env.FAIL_THRESHOLD !== undefined
  ? Number(process.env.FAIL_THRESHOLD)
  : 0.005; // 0.5%

/**
 * Settle the page so both sides are captured in the same visual state:
 * scroll to the bottom to trigger every data-sal / WOW / waypoint animation,
 * return to the top, then wait for transitions to finish.
 */
async function settle(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = () => {
        y += window.innerHeight;
        window.scrollTo(0, y);
        if (y < document.body.scrollHeight) setTimeout(step, 60);
        else resolve(undefined);
      };
      step();
    });
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);

  // Carousels autoplay, so the two captures would otherwise land on different
  // slides. Stop autoplay and pin every Swiper to its first slide on both sides.
  await page.evaluate(() => {
    document.querySelectorAll('.swiper').forEach((el) => {
      const sw = el.swiper;
      if (!sw) return;
      try {
        sw.autoplay?.stop?.();
        sw.slideTo(0, 0);
        sw.update?.();
      } catch { /* a dead instance must not break the capture */ }
    });
  });
  await page.waitForTimeout(600);
  // Freeze anything still animating so the capture is deterministic.
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-play-state: paused !important;
      transition: none !important;
      caret-color: transparent !important;
    }`,
  });
  await page.waitForTimeout(200);
}

async function capture(context, url, viewport, selector) {
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
  } catch {
    // networkidle is unreachable on the live site (the search widget polls);
    // 'load' plus the settle pass is the reliable signal.
  }
  await page.waitForTimeout(1200);
  await settle(page);

  const target = selector ? page.locator(selector).first() : page;
  const buf = await target.screenshot({
    fullPage: !selector,
    animations: 'disabled',
    timeout: 60_000,
  });
  await page.close();
  return buf;
}

function compare(aBuf, bBuf) {
  const a = PNG.sync.read(aBuf);
  const b = PNG.sync.read(bBuf);
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);

  // Crop both to the shared area so a height difference does not mask the rest.
  const crop = (img) => {
    const out = new PNG({ width, height });
    PNG.bitblt(img, out, 0, 0, width, height, 0, 0);
    return out;
  };
  const ca = crop(a);
  const cb = crop(b);
  const diff = new PNG({ width, height });
  const differing = pixelmatch(ca.data, cb.data, diff.data, width, height, {
    threshold: 0.1,
    includeAA: false,
  });

  return {
    differing,
    total: width * height,
    ratio: differing / (width * height),
    sizeMismatch: a.width !== b.width || a.height !== b.height,
    liveSize: `${a.width}x${a.height}`,
    localSize: `${b.width}x${b.height}`,
    diffPng: PNG.sync.write(diff),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  let selector = null;
  let viewportFilter = null;
  const paths = [];

  let family = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--selector') selector = argv[++i];
    else if (argv[i] === '--viewport') viewportFilter = argv[++i];
    else if (argv[i] === '--family') family = argv[++i];
    else paths.push(argv[i]);
  }

  // --family sweeps every page in a route family. Avoids passing 49 paths on the
  // command line, which zsh will not word-split from an unquoted variable.
  if (family) {
    const inv = JSON.parse(await readFile(new URL('../data/inventory.json', import.meta.url), 'utf8'));
    for (const p of inv.pages) if (p.family === family) paths.push(p.path);
    if (!paths.length) {
      console.error(`no pages in family "${family}"`);
      process.exit(1);
    }
  }

  if (!paths.length) {
    const inv = JSON.parse(await readFile(new URL('../data/inventory.json', import.meta.url), 'utf8'));
    // One representative page per route family by default.
    const seen = new Set();
    for (const p of inv.pages) {
      if (seen.has(p.family)) continue;
      seen.add(p.family);
      paths.push(p.path);
    }
  }

  const viewports = viewportFilter
    ? VIEWPORTS.filter((v) => v.name === viewportFilter)
    : VIEWPORTS;

  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    // Match the crawl's UA so the server returns identical markup.
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  });

  // Build the full job list, then run it through a concurrency pool. Serial
  // execution costs ~10s per page (two captures, each with an animation settle),
  // which is untenable across 162 pages.
  const jobs = [];
  for (const path of paths) for (const vp of viewports) jobs.push({ path, vp });

  const CONCURRENCY = Number(process.env.DIFF_CONCURRENCY ?? 4);
  const results = [];
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < jobs.length) {
      const { path, vp } = jobs[cursor++];
      const label = `${path === '/' ? 'index' : path.replace(/\//g, '_').replace(/^_/, '')}@${vp.name}${selector ? `~${selector.replace(/\W+/g, '')}` : ''}`;
      try {
        const [liveBuf, localBuf] = await Promise.all([
          capture(context, LIVE + path, vp, selector),
          capture(context, LOCAL + path, vp, selector),
        ]);
        const r = compare(liveBuf, localBuf);
        const pass = r.ratio <= FAIL_THRESHOLD;
        console.log(
          `  [${String(++done).padStart(3)}/${jobs.length}] ${label.padEnd(50)} ${pass ? 'PASS' : 'FAIL'}  ${(r.ratio * 100).toFixed(3)}%  ${r.sizeMismatch ? `size ${r.liveSize} vs ${r.localSize}` : ''}`
        );
        if (!pass || r.sizeMismatch) {
          await writeFile(new URL(`${label}.live.png`, OUT), liveBuf);
          await writeFile(new URL(`${label}.local.png`, OUT), localBuf);
          await writeFile(new URL(`${label}.diff.png`, OUT), r.diffPng);
        }
        results.push({ path, viewport: vp.name, ratio: r.ratio, pass, ...r, diffPng: undefined });
      } catch (err) {
        console.log(`  [${String(++done).padStart(3)}/${jobs.length}] ${label.padEnd(50)} ERROR  ${err.message}`);
        results.push({ path, viewport: vp.name, error: err.message, pass: false });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  results.sort((a, b) => a.path.localeCompare(b.path) || a.viewport.localeCompare(b.viewport));

  await browser.close();
  await writeFile(new URL('report.json', OUT), JSON.stringify(results, null, 2));

  const failed = results.filter((r) => !r.pass);
  console.log(`\n--- ${results.length - failed.length}/${results.length} passed (threshold ${FAIL_THRESHOLD * 100}%) ---`);
  if (failed.length) {
    console.log('failures:');
    for (const f of failed) {
      console.log(`  ${f.path} @${f.viewport}  ${f.error ?? (f.ratio * 100).toFixed(3) + '%'}`);
    }
    process.exitCode = 1;
  }
}

main();
