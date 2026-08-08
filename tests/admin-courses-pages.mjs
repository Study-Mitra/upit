/**
 * Courses and Pages admin round trips.
 *
 *   node tests/admin-courses-pages.mjs http://localhost:3001
 *
 * Creates a course, checks it on the public site, duplicates it, deletes both.
 * Then edits a real page's SEO title, verifies it reaches the public page, and
 * restores the original value. Uses a throwaway admin account.
 */
import { chromium } from '@playwright/test';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { MONGODB_URI as URI, MONGODB_DB as DB } from '../lib/env.mjs';

const BASE = process.argv[2] ?? process.env.LOCAL_ORIGIN ?? 'http://localhost:3000';
const EMAIL = 'test-only@example.invalid';
const PASSWORD = 'correct-horse-battery-staple';
const SLUG = 'zz-test-course';
const PAGE_PATH = '/about';

let failures = 0;
function check(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!pass) failures++;
}

const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 5000 }).connect();
const db = client.db(DB);
const users = db.collection('adminUsers');
const courses = db.collection('courses');
const pages = db.collection('pages');

// Snapshot the page we are about to edit so it can be restored exactly.
const original = await pages.findOne({ path: PAGE_PATH });
if (!original) {
  console.error(`FATAL: ${PAGE_PATH} not in the database.`);
  await client.close();
  process.exit(1);
}

async function cleanup() {
  await courses.deleteMany({ slug: { $regex: `^${SLUG}` } });
  await users.deleteOne({ email: EMAIL });
  await pages.updateOne(
    { path: PAGE_PATH },
    { $set: { name: original.name, contentHtml: original.contentHtml, seo: original.seo } }
  );
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
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button:has-text("Sign in")');
  await page.waitForURL(/\/admin$/, { timeout: 20000 });
  check('signed in', /\/admin$/.test(page.url()));

  // ============================ COURSES ============================
  await page.goto(`${BASE}/admin/courses`, { waitUntil: 'networkidle' });
  const courseRows = await page.locator('.a-table tbody tr').count();
  check('courses list shows every course', courseRows === 49, `${courseRows} rows`);

  await page.goto(`${BASE}/admin/courses/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.fill('input[name="name"]', 'ZZ Test Course');
  await page.fill('input[name="slug"]', SLUG);
  await page.fill('input[name="aboutHeading"]', 'About ZZ Test Course');
  await page.fill('input[name="bannerImage"]', '/new-assets/img/courses/mba_banner.png');

  // Add a details row and confirm the block/badge distinction survives.
  await page.click('button:has-text("Add detail row")');
  await page.fill('input[name="detailLabel"]', 'Eligibility');
  await page.fill('input[name="detailValue"]', '10+2 from a recognized board');
  await page.selectOption('select[name="detailStyle"]', 'block');

  await page.click('button:has-text("Create course")');
  await page.waitForURL(new RegExp(`/admin/courses/${SLUG}`), { timeout: 20000 });
  check('course created', page.url().includes(SLUG), page.url());

  const made = await courses.findOne({ slug: SLUG });
  check('course record written', !!made);
  check('kind defaults to detail', made?.kind === 'detail', made?.kind);
  check('details row saved', (made?.details ?? []).length === 1, JSON.stringify(made?.details));
  check('detail style preserved', made?.details?.[0]?.style === 'block', made?.details?.[0]?.style);
  check('bodyHtml absent on a detail course', made?.bodyHtml === undefined);

  const cPub = await page.goto(`${BASE}/course/${SLUG}`, { waitUntil: 'domcontentloaded' });
  check('public course page renders', cPub?.status() === 200, String(cPub?.status()));

  // duplicate
  await page.goto(`${BASE}/admin/courses/${SLUG}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.click('button:has-text("Duplicate")');
  await page.waitForURL(new RegExp(`/admin/courses/${SLUG}-copy`), { timeout: 20000 });
  const cCopy = await courses.findOne({ slug: `${SLUG}-copy` });
  check('course duplicated', !!cCopy, cCopy?.slug);
  check('copy name distinguishable', (cCopy?.name ?? '').includes('(copy)'), cCopy?.name);
  check('copy keeps the details rows', (cCopy?.details ?? []).length === 1);

  for (const s of [`${SLUG}-copy`, SLUG]) {
    await page.goto(`${BASE}/admin/courses/${s}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.click('button:has-text("Delete")');
    await page.waitForURL(/\/admin\/courses$/, { timeout: 20000 });
  }
  check('both courses deleted', (await courses.countDocuments({ slug: { $regex: `^${SLUG}` } })) === 0);

  // ============================= PAGES =============================
  await page.goto(`${BASE}/admin/pages`, { waitUntil: 'networkidle' });
  const pageRows = await page.locator('.a-table tbody tr').count();
  check('pages list renders', pageRows > 0, `${pageRows} rows`);

  const lockedShown = await page.locator('.a-table tbody tr:has-text("/university")').count();
  check('locked families are hidden', lockedShown === 0, `${lockedShown} locked rows visible`);

  await page.goto(`${BASE}/admin/pages/edit?path=${encodeURIComponent(PAGE_PATH)}`, {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(3000);
  const marker = `ZZ SEO ${Date.now()}`;
  await page.fill('input[name="seoTitle"]', marker);
  await page.click('button:has-text("Save changes")');
  await page.waitForSelector('.a-msg-success', { timeout: 20000 });
  check('page saved', true);

  const after = await pages.findOne({ path: PAGE_PATH });
  check('SEO title persisted', after?.seo?.title === marker, after?.seo?.title);
  check(
    'content not blanked by the save',
    (after?.contentHtml ?? '').length > 100,
    `${(after?.contentHtml ?? '').length} chars`
  );

  await page.goto(`${BASE}${PAGE_PATH}`, { waitUntil: 'domcontentloaded' });
  const title = await page.title();
  check('public page reflects the new SEO title', title === marker, title);

  const real = errs.filter((e) => !/selectpicker|reading 'value'/.test(e));
  check('no unexpected page errors', real.length === 0, real.join(' | ') || 'clean');
} finally {
  await browser.close();
  await cleanup();
  const restored = await pages.findOne({ path: PAGE_PATH });
  console.log(
    `\nrestored ${PAGE_PATH}: seo.title = ${JSON.stringify(restored?.seo?.title)} ` +
      `(original ${JSON.stringify(original.seo?.title)})`
  );
  await client.close();
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILING CHECK(S)`}`);
process.exit(failures === 0 ? 0 : 1);
