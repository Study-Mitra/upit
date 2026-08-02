/**
 * Diagnostic probe: compare geometry, computed styles and font loading between
 * the live site and the local build for a given path.
 *
 * Usage: node scripts/probe.mjs [path] [viewportWidth]
 */
import { chromium } from 'playwright';

const LIVE = 'https://srmflexilearn.com';
const LOCAL = process.env.LOCAL_ORIGIN ?? 'http://localhost:3000';

const SELECTORS = [
  'header.rbt-header',
  '.rbt-header-wrapper',
  '.rbt-header-wrapper > .container',
  '.rbt-header-wrapper .container-fluid',
  '.mainmenu-nav',
  '.mainmenu',
  '.header-right',
  '.logo',
  'body',
  'html',
];

async function probe(url, width, height) {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  });
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
  } catch { /* settle below regardless */ }
  await page.waitForTimeout(2500);

  const data = await page.evaluate((sels) => {
    const out = { boxes: {}, styles: {}, fonts: {}, misc: {} };
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el) { out.boxes[sel] = null; continue; }
      const r = el.getBoundingClientRect();
      out.boxes[sel] = {
        x: +r.x.toFixed(2), y: +r.y.toFixed(2),
        w: +r.width.toFixed(2), h: +r.height.toFixed(2),
      };
      const cs = getComputedStyle(el);
      out.styles[sel] = {
        fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight,
        marginLeft: cs.marginLeft, marginRight: cs.marginRight,
        maxWidth: cs.maxWidth, display: cs.display, position: cs.position,
      };
    }
    out.misc.innerWidth = window.innerWidth;
    out.misc.clientWidth = document.documentElement.clientWidth;
    out.misc.scrollbar = window.innerWidth - document.documentElement.clientWidth;
    out.misc.bodyScrollHeight = document.body.scrollHeight;
    out.misc.docHeight = document.documentElement.scrollHeight;

    const faces = ['300', '400', '500', '600', '700'];
    for (const w of faces) {
      out.fonts[`Euclid ${w}`] = document.fonts.check(`${w} 16px "Euclid Circular"`);
    }
    out.fonts.loadedCount = document.fonts.size;
    out.misc.rootVars = {
      primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
      secondary: getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim(),
      heading: getComputedStyle(document.documentElement).getPropertyValue('--color-heading').trim(),
    };
    return out;
  }, SELECTORS);

  await browser.close();
  return data;
}

const path = process.argv[2] ?? '/';
const width = parseInt(process.argv[3] ?? '1440', 10);

const [live, local] = await Promise.all([
  probe(LIVE + path, width, 900),
  probe(LOCAL + path, width, 900),
]);

console.log(`=== ${path} @ ${width}px ===\n`);
console.log('misc:');
for (const k of Object.keys(live.misc)) {
  const a = JSON.stringify(live.misc[k]);
  const b = JSON.stringify(local.misc[k]);
  console.log(`  ${k.padEnd(18)} live=${String(a).padEnd(26)} local=${String(b).padEnd(26)} ${a === b ? '' : '  <-- DIFF'}`);
}

console.log('\nfonts:');
for (const k of Object.keys(live.fonts)) {
  const a = live.fonts[k], b = local.fonts[k];
  console.log(`  ${k.padEnd(18)} live=${String(a).padEnd(8)} local=${String(b).padEnd(8)} ${a === b ? '' : '  <-- DIFF'}`);
}

console.log('\nboxes:');
for (const sel of SELECTORS) {
  const a = live.boxes[sel], b = local.boxes[sel];
  if (!a && !b) { console.log(`  ${sel.padEnd(36)} (absent both)`); continue; }
  if (!a || !b) { console.log(`  ${sel.padEnd(36)} <-- present only in ${a ? 'live' : 'local'}`); continue; }
  const same = JSON.stringify(a) === JSON.stringify(b);
  console.log(`  ${sel.padEnd(36)} ${same ? 'ok' : 'DIFF'}`);
  if (!same) {
    console.log(`      live : x=${a.x} y=${a.y} w=${a.w} h=${a.h}`);
    console.log(`      local: x=${b.x} y=${b.y} w=${b.w} h=${b.h}`);
  }
}

console.log('\nstyle diffs:');
for (const sel of SELECTORS) {
  const a = live.styles[sel], b = local.styles[sel];
  if (!a || !b) continue;
  for (const k of Object.keys(a)) {
    if (a[k] !== b[k]) console.log(`  ${sel} .${k}: live="${a[k]}" local="${b[k]}"`);
  }
}
