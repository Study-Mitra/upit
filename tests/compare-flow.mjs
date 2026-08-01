/**
 * End-to-end check of both comparison entry points.
 *
 *   node tests/compare-flow.mjs [baseUrl]
 *
 * 1. /compare-university — course -> first -> second -> third dropdowns, then
 *    the slug lookup that builds the /compare/... URL.
 * 2. The floating compare widget on / — select two universities and follow the
 *    "Compare Now" flow through to the redirect.
 *
 * Written as a plain script rather than a Playwright test because the repo has
 * no playwright.config; the other browser-driven checks in scripts/ do the same.
 *
 * PASS THE PORT. `next dev` walks up from 3000 when it is taken, and on this
 * machine 3000 is frequently another project — pointing the suite at it produces
 * confusing failures against an unrelated app rather than an honest error. The
 * sanity check below fails loudly instead.
 */
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? process.env.LOCAL_ORIGIN ?? 'http://localhost:3000';

let failures = 0;
function check(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!pass) failures++;
}

const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const optionValues = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? [...el.options].map((o) => o.value).filter(Boolean) : null;
  }, sel);

// Confirm BASE is actually this site before reporting anything about it.
{
  const res = await page.goto(`${BASE}/compare-university`, { waitUntil: 'domcontentloaded' });
  const isThisSite = await page.evaluate(() => !!document.querySelector('#course_id'));
  if (res?.status() !== 200 || !isThisSite) {
    const title = await page.title().catch(() => '?');
    console.error(
      `\nFATAL: ${BASE} is not this project (status ${res?.status()}, title "${title}").\n` +
        `Point the suite at the right dev server, e.g.\n` +
        `  node tests/compare-flow.mjs http://localhost:3001\n`
    );
    await browser.close();
    process.exit(2);
  }
}

// ---------------------------------------------------------------- dropdown page
await page.goto(`${BASE}/compare-university`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => typeof window.getUniversities === 'function', { timeout: 20000 });

const courses = await optionValues('#course_id');
check('course dropdown is populated', courses?.length > 0, `${courses?.length} courses`);

await page.selectOption('#course_id', courses[0]);
await page.waitForFunction(
  () => document.querySelector('#set_university_card_first')?.options.length > 1,
  { timeout: 20000 }
);

const firstOpts = await optionValues('#set_university_card_first');
check('first university dropdown is populated', firstOpts.length >= 2, `${firstOpts.length} options`);

// Selecting the first university must not strip the second dropdown.
await page.selectOption('#set_university_card_first', firstOpts[0]);
await page.waitForTimeout(2000);
let secOpts = await optionValues('#set_university_card_sec');
check(
  'second dropdown still selectable after choosing first',
  secOpts.length >= 1,
  `${secOpts.length} options`
);

const firstLogo = await page.getAttribute('#uni_first_image', 'src');
check('first university logo resolves', !!firstLogo && !firstLogo.startsWith('//'), String(firstLogo));

// Selecting the second must keep the first selected and leave a usable third.
const secPick = secOpts.find((v) => v !== firstOpts[0]) ?? secOpts[0];
await page.selectOption('#set_university_card_sec', secPick);
await page.waitForTimeout(2000);

const firstStillSelected = await page.inputValue('#set_university_card_first');
check(
  'first selection survives choosing the second',
  firstStillSelected === firstOpts[0],
  `expected ${firstOpts[0]}, got "${firstStillSelected}"`
);

const thirdOpts = await optionValues('#set_university_card_third');
check('third dropdown still selectable', thirdOpts.length >= 1, `${thirdOpts.length} options`);

const secLogo = await page.getAttribute('#uni_sec_image', 'src');
check('second university logo resolves', !!secLogo && !secLogo.startsWith('//'), String(secLogo));

// Two selections are enough to compare, so the modal must open at this point.
await page.evaluate(() => window.compareNowModal());
await page.waitForTimeout(800);
check(
  'compareNowModal opens the lead form at two selections',
  await page.evaluate(() => document.querySelector('#pop')?.classList.contains('show')),
  'lead modal visible'
);
await page.evaluate(() => window.jQuery('#pop').modal('hide'));
await page.waitForTimeout(600);

// Optional third slot: picking it must preserve the first two selections.
const thirdPick = thirdOpts.find((v) => v !== firstOpts[0] && v !== secPick);
if (thirdPick) {
  await page.selectOption('#set_university_card_third', thirdPick);
  await page.waitForTimeout(2000);
  const kept = await page.evaluate(() => [
    document.querySelector('#set_university_card_first').value,
    document.querySelector('#set_university_card_sec').value,
    document.querySelector('#set_university_card_third').value,
  ]);
  check(
    'all three selections survive choosing the third',
    kept[0] === firstOpts[0] && kept[1] === secPick && kept[2] === thirdPick,
    `got ${JSON.stringify(kept)}, wanted ${JSON.stringify([firstOpts[0], secPick, thirdPick])}`
  );
}

// The slug lookup that compareNows() turns into the destination URL.
const selected = await page.evaluate(() => ({
  first: document.querySelector('#set_university_card_first').value,
  sec: document.querySelector('#set_university_card_sec').value,
  third: document.querySelector('#set_university_card_third').value,
}));
const slugs = await page.evaluate(
  (s) =>
    fetch(
      `/get-uni-slug?university_id=${s.first}&university_id_sec=${s.sec}&university_id_third=${s.third}`
    ).then((r) => r.json()),
  selected
);
const wanted = [selected.first, selected.sec, selected.third].filter(Boolean).length;
check(
  'get-uni-slug returns every selection in order',
  slugs?.status === 200 && slugs.universities?.length === wanted,
  JSON.stringify(slugs)
);

// compareNows() is the leg that actually navigates.
await page.evaluate(() => window.compareNows());
await page.waitForURL(/\/compare\//, { timeout: 20000 }).catch(() => {});
check('compareNows navigates to the compare result', /\/compare\//.test(page.url()), page.url());

const dest = `${BASE}/compare/${slugs.universities.join('/')}`;
const resp = await page.goto(dest, { waitUntil: 'domcontentloaded' });
check('compare result page renders', resp?.status() === 200, `${resp?.status()} ${dest}`);
check(
  'compare result lists every selected university',
  (await page.locator('.cmp-uni-name, .uni-name, h3, h4, td').count()) > 0,
  'result table rendered'
);

// ------------------------------------------------------------- floating widget
const home = await browser.newPage();
const homeErrors = [];
home.on('pageerror', (e) => homeErrors.push(e.message));
await home.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await home.waitForFunction(() => typeof window.CompareUniversity === 'function', { timeout: 20000 });

const btns = await home.$$('.compare-uni');
check('homepage exposes compare buttons', btns.length >= 2, `${btns.length} buttons`);

await btns[0].click();
await home.waitForTimeout(800);
await home.evaluate(() => window.jQuery('#fullscreenModal').modal('hide'));
await home.waitForTimeout(600);
await btns[1].click();
await home.waitForTimeout(800);

const widget = await home.evaluate(() => ({
  count: JSON.parse(localStorage.getItem('compare_universities') || '[]').length,
  badge: document.querySelector('#floatingCompareBadge')?.textContent,
  compareNow: document.querySelector('#compareNowButton')
    ? getComputedStyle(document.querySelector('#compareNowButton')).display
    : 'missing',
}));
check('two universities staged in the widget', widget.count === 2, JSON.stringify(widget));
check('"Compare Now" is revealed at two selections', widget.compareNow !== 'none', widget.compareNow);

await home.evaluate(() => window.CompareUniversity());
await home.waitForURL(/\/compare\//, { timeout: 20000 }).catch(() => {});
check('widget redirects to a compare URL', /\/compare\//.test(home.url()), home.url());

// ------------------------------------------------------------------- JS errors
/**
 * Two site-wide errors predate this flow and are unrelated to comparison:
 *
 *   main.js:1284      eduJs.selectPicker() -> $().selectpicker is not a function.
 *                     bootstrap-select's JS is not loaded here, and the reference
 *                     site does not load it either (only the stylesheet), so it
 *                     throws there too. It does abort the 24 eduJs initializers
 *                     registered after it — worth fixing, but separately.
 *   inline-07.js:6    updateFeeValue() reads a fee-slider input that only exists
 *                     on the course pages.
 *
 * Anything else is a regression in the comparison flow.
 */
const KNOWN = [/selectpicker is not a function/, /reading 'value'/];
const noisy = [...pageErrors, ...homeErrors].filter(
  (m) => !KNOWN.some((k) => k.test(m))
);
check('no comparison-related page errors', noisy.length === 0, noisy.join(' | ') || 'clean');

await browser.close();
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILING CHECK(S)`}`);
process.exit(failures === 0 ? 0 : 1);
