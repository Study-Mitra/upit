/**
 * The header top bar on phone-sized viewports.
 *
 *   node tests/header-mobile.mjs [baseUrl]
 *
 * The theme collapses .rbt-header-top to a single 32px row on mobile and reveals
 * the rest when the "+" (.topbar-expend-button) is tapped. Two things went wrong
 * with the rebrand's longer contact details:
 *
 *  1. The information list wraps to a second row, and the clip happens on
 *     .rbt-header-top (46px, padding included) rather than on the 32px wrapper —
 *     so ~11px of the 22px address row leaks through and renders as a line of
 *     text sliced in half.
 *  2. .top-bar-expended is absolutely positioned at right:25px over the same
 *     strip, so it lands on top of the email address.
 *
 * A row must be either fully visible or fully hidden. Half a row is the bug.
 *
 * PASS THE PORT — `next dev` walks up from 3000 when it is taken, and pointing
 * this at another project's app produces confusing failures. Same convention as
 * the other tests here.
 */
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? process.env.LOCAL_ORIGIN ?? 'http://localhost:3000';

const VIEWPORTS = [
  { name: 'galaxy-s', width: 360, height: 740 },
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-14', width: 390, height: 844 },
];

let failures = 0;
function check(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!pass) failures++;
}

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const collapsed = await page.evaluate(() => {
    const bar = document.querySelector('.rbt-header-top');
    const barBox = bar.getBoundingClientRect();
    const rows = [...document.querySelectorAll('.rbt-information-list > li')].map((li) => {
      const b = li.getBoundingClientRect();
      return { text: li.innerText.trim().slice(0, 32), top: b.top, bottom: b.bottom, right: b.right };
    });
    const btn = document.querySelector('.top-bar-expended');
    const btnBox = btn ? btn.getBoundingClientRect() : null;
    return { barBottom: barBox.bottom, rows, btnBox: btnBox && { left: btnBox.left, right: btnBox.right, top: btnBox.top, bottom: btnBox.bottom } };
  });

  // 1. No row may be sliced by the collapsed bar's bottom edge.
  const sliced = collapsed.rows.filter(
    (r) => r.top < collapsed.barBottom - 1 && r.bottom > collapsed.barBottom + 1
  );
  check(
    `${vp.name} collapsed: no half-clipped row`,
    sliced.length === 0,
    sliced.length ? `sliced: ${sliced.map((r) => `"${r.text}" (${Math.round(r.top)}→${Math.round(r.bottom)}, bar ends ${Math.round(collapsed.barBottom)})`).join('; ')}` : undefined
  );

  // 2. The expand button must not sit on top of a visible contact item.
  if (collapsed.btnBox) {
    const overlapped = collapsed.rows.filter(
      (r) =>
        r.bottom <= collapsed.barBottom + 1 &&
        r.right > collapsed.btnBox.left &&
        r.bottom > collapsed.btnBox.top &&
        r.top < collapsed.btnBox.bottom
    );
    check(
      `${vp.name} collapsed: expand button clear of contact text`,
      overlapped.length === 0,
      overlapped.length ? `overlaps: ${overlapped.map((r) => `"${r.text}"`).join(', ')}` : undefined
    );
  }

  // 3. Tapping "+" must reveal every contact item in full.
  await page.click('.topbar-expend-button');
  await page.waitForTimeout(500);
  // Geometry alone cannot judge the expanded state: .active sets
  // `overflow: visible`, so a row below the bar's own box is still on screen.
  // Hit-test the row's centre instead — if an ancestor clips it, or anything
  // covers it, elementFromPoint returns something outside the row.
  const expanded = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.rbt-information-list > li')]
      .filter((li) => li.innerText.trim())
      .map((li) => {
        const b = li.getBoundingClientRect();
        const cx = Math.round(b.left + Math.min(b.width, 40) / 2);
        const cy = Math.round(b.top + b.height / 2);
        const hit = document.elementFromPoint(cx, cy);
        return {
          text: li.innerText.trim().slice(0, 32),
          onScreen: b.height > 0 && b.top >= 0 && b.bottom <= window.innerHeight,
          hit: hit ? li.contains(hit) || hit === li : false,
        };
      });
    return { rows };
  });
  const hidden = expanded.rows.filter((r) => !r.onScreen || !r.hit);
  check(
    `${vp.name} expanded: all contact rows fully revealed`,
    hidden.length === 0,
    hidden.length ? `still clipped: ${hidden.map((r) => `"${r.text}"`).join(', ')}` : undefined
  );

  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
