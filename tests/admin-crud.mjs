/**
 * Admin CRUD round trip: create a college, see it on the public site, duplicate
 * it, then delete both. Also exercises the leads screens and the CSV export.
 *
 *   node tests/admin-crud.mjs http://localhost:3001
 *
 * Signs in with a throwaway admin account and removes it afterwards, so the real
 * account's password is never needed or changed. Every college it creates is
 * deleted again, including on failure.
 */
import { chromium } from '@playwright/test';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

const BASE = process.argv[2] ?? process.env.LOCAL_ORIGIN ?? 'http://localhost:3000';
const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const DB = process.env.MONGODB_DB ?? 'srmflexilearn';
const EMAIL = 'test-only@example.invalid';
const PASSWORD = 'correct-horse-battery-staple';
const SLUG = 'zz-test-college';

let failures = 0;
function check(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!pass) failures++;
}

const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 5000 }).connect();
const db = client.db(DB);
const users = db.collection('adminUsers');
const unis = db.collection('universities');

async function cleanup() {
  await unis.deleteMany({ slug: { $regex: `^${SLUG}` } });
  await users.deleteOne({ email: EMAIL });
}
await cleanup();
await users.insertOne({
  email: EMAIL,
  passwordHash: await bcrypt.hash(PASSWORD, 12),
  createdAt: new Date(),
  updatedAt: new Date(),
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

try {
  // ---- sign in ----
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL(/\/admin$/, { timeout: 20000 });
  check('signed in', /\/admin$/.test(page.url()));

  // ---- colleges list ----
  await page.goto(`${BASE}/admin/colleges`, { waitUntil: 'networkidle' });
  const rows = await page.locator('.a-table tbody tr').count();
  check('colleges list shows every college', rows === 19, `${rows} rows`);
  const flagged = await page.locator('.a-badge-contacted').count();
  check('colleges with no courses are flagged', flagged === 9, `${flagged} flagged`);

  // ---- create ----
  await page.goto(`${BASE}/admin/colleges/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500); // editors mount
  await page.fill('input[name="name"]', 'ZZ Test College');
  await page.fill('input[name="slug"]', SLUG);
  await page.fill('input[name="location"]', 'Testville, Testland');
  await page.fill('input[name="logo"]', '/new-assets/img/university/amity-university_logo.webp');
  await page.fill('input[name="banner"]', '/new-assets/img/university/amity-university_banner.jpg');
  await page.fill('textarea[name="excerpt"]', 'A college created by the admin CRUD test.');
  // NOT button[type="submit"]: the sidebar's "Sign out" is the first submit
  // button on the page, so a bare selector signs the test out instead.
  await page.click('button:has-text("Create college")');
  await page.waitForURL(new RegExp(`/admin/colleges/${SLUG}`), { timeout: 20000 });
  check('created and redirected to the edit page', page.url().includes(SLUG), page.url());

  const created = await unis.findOne({ slug: SLUG });
  check('record written', !!created);
  check('compareId allocated', !!created?.compareId, String(created?.compareId));
  check('compareId is unique', (await unis.countDocuments({ compareId: created.compareId })) === 1);
  check('cardHtml generated', !!created?.cardHtml && created.cardHtml.includes(SLUG));

  // ---- visible on the public site ----
  const detail = await page.goto(`${BASE}/university/${SLUG}`, { waitUntil: 'domcontentloaded' });
  check('public detail page renders', detail?.status() === 200, String(detail?.status()));
  const heroName = await page.textContent('.university-title').catch(() => null);
  check('detail page shows the name', (heroName ?? '').includes('ZZ Test College'), heroName ?? '');

  await page.goto(`${BASE}/university`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const onListing = await page.locator(`#university-list a[href="/university/${SLUG}"]`).count();
  check('appears on the public listing', onListing > 0, `${onListing} links`);
  const listedCount = await page.textContent('#university_count').catch(() => '');
  check('listing count includes it', listedCount?.trim() === '20', listedCount ?? '');

  // ---- visible to the comparison feature ----
  const compareOpts = await page.evaluate(() =>
    fetch('/get-universities').then((r) => r.json())
  );
  const inCompare = (compareOpts.universities ?? []).some((x) => x.name === 'ZZ Test College');
  check('appears in the compare dropdowns', inCompare, `${compareOpts.universities?.length} options`);

  // ---- duplicate ----
  await page.goto(`${BASE}/admin/colleges/${SLUG}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.click('button:has-text("Duplicate")');
  await page.waitForURL(new RegExp(`/admin/colleges/${SLUG}-copy`), { timeout: 20000 });
  check('duplicate created', page.url().includes(`${SLUG}-copy`), page.url());

  const copy = await unis.findOne({ slug: `${SLUG}-copy` });
  check('copy has its own compareId', copy?.compareId !== created?.compareId,
    `${created?.compareId} vs ${copy?.compareId}`);
  check('copy name is distinguishable', (copy?.name ?? '').includes('(copy)'), copy?.name);
  check('copy cardHtml points at the copy', (copy?.cardHtml ?? '').includes(`${SLUG}-copy`));
  check('copy carries the section fields', (copy?.about ?? '') === (created?.about ?? ''));

  // ---- leads ----
  await page.goto(`${BASE}/admin/leads`, { waitUntil: 'networkidle' });
  const leadRows = await page.locator('.a-table tbody tr').count();
  // Compared against the database, not a fixed number: real enquiries arrive
  // through /lead-submit at any time, so a hardcoded count fails for a reason
  // that has nothing to do with the admin.
  const leadCount = await db.collection('leads').countDocuments();
  check('leads list shows every lead', leadRows === leadCount, `${leadRows} rows vs ${leadCount} in DB`);
  const csv = await page.evaluate(() =>
    fetch('/admin/leads/export').then((r) => ({ status: r.status, type: r.headers.get('content-type') }))
  );
  check('CSV export works', csv.status === 200 && /csv/.test(csv.type ?? ''), JSON.stringify(csv));

  // ---- delete both ----
  for (const s of [`${SLUG}-copy`, SLUG]) {
    await page.goto(`${BASE}/admin/colleges/${s}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.click('button:has-text("Delete")');
    await page.waitForURL(/\/admin\/colleges$/, { timeout: 20000 });
  }
  check('both deleted', (await unis.countDocuments({ slug: { $regex: `^${SLUG}` } })) === 0);
  const gone = await page.goto(`${BASE}/university/${SLUG}`, { waitUntil: 'domcontentloaded' });
  check('public page 404s after delete', gone?.status() === 404, String(gone?.status()));

  const real = errs.filter((e) => !/selectpicker|reading 'value'/.test(e));
  check('no unexpected page errors', real.length === 0, real.join(' | ') || 'clean');
} finally {
  await browser.close();
  await cleanup();
  await client.close();
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILING CHECK(S)`}`);
process.exit(failures === 0 ? 0 : 1);
