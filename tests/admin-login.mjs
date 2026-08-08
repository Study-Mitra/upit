/**
 * End-to-end admin login.
 *
 *   node tests/admin-login.mjs http://localhost:3001
 *
 * Creates a throwaway admin account and deletes it afterwards: the real
 * account's password is known only to the user and must never be reset. Also
 * covers what would otherwise be unit tests of verifyCredentials (wrong
 * password, unknown email, case-insensitive email), because nothing in this repo
 * can import the TypeScript module directly — no TS runner is installed.
 */
import { chromium } from '@playwright/test';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { MONGODB_URI as URI, MONGODB_DB as DB } from '../lib/env.mjs';

const BASE = process.argv[2] ?? process.env.LOCAL_ORIGIN ?? 'http://localhost:3000';
const EMAIL = 'test-only@example.invalid';
const PASSWORD = 'correct-horse-battery-staple';
const REAL_ACCOUNT = 'admin@upitcollege.com';

let failures = 0;
function check(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!pass) failures++;
}

const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 5000 }).connect();
const users = client.db(DB).collection('adminUsers');
await users.deleteOne({ email: EMAIL });
await users.insertOne({
  email: EMAIL,
  passwordHash: await bcrypt.hash(PASSWORD, 12),
  createdAt: new Date(),
  updatedAt: new Date(),
});

const browser = await chromium.launch();
const page = await browser.newPage();

/** Submit the form and settle, whether it errors inline or navigates. */
async function signIn(email, password) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(700);
}

try {
  // Refuse to run against a different app on a recycled port.
  const first = await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
  const looksRight = await page.evaluate(
    () => !!document.querySelector('input[name="email"]') && !!document.querySelector('.a-login')
  );
  if (first?.status() !== 200 || !looksRight) {
    console.error(
      `\nFATAL: ${BASE}/admin/login did not serve this project's login page ` +
        `(status ${first?.status()}, title "${await page.title().catch(() => '?')}").\n` +
        `  node tests/admin-login.mjs http://localhost:3001\n`
    );
    await browser.close();
    await users.deleteOne({ email: EMAIL });
    await client.close();
    process.exit(2);
  }
  check('login page returns 200', first.status() === 200);

  // --- wrong password ---
  await signIn(EMAIL, 'definitely-wrong');
  const err = (await page.textContent('.a-msg-error').catch(() => null))?.trim() ?? '';
  check('wrong password shows an error', !!err, err);
  check('message is generic', /invalid email or password/i.test(err), err);
  check('still on the login page', /\/admin\/login/.test(page.url()), page.url());
  let cookies = await page.context().cookies();
  check('no session cookie after failure', !cookies.some((c) => c.name === 'upit_admin_session'));

  // --- unknown email: identical message, no account enumeration ---
  await signIn('nobody@example.invalid', PASSWORD);
  const err2 = (await page.textContent('.a-msg-error').catch(() => null))?.trim() ?? '';
  check('unknown email is rejected', !!err2, err2);
  check('unknown email message identical to wrong password', err2 === err, `${err2} vs ${err}`);

  // --- correct password ---
  await signIn(EMAIL, PASSWORD);
  check('redirected to the dashboard', /\/admin$/.test(page.url()), page.url());
  cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === 'upit_admin_session');
  check('session cookie set', !!session);
  check('session cookie is httpOnly', session?.httpOnly === true);

  // --- guarded page reachable while signed in ---
  const dash = await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  check('dashboard reachable when signed in', dash?.status() === 200, String(dash?.status()));

  // --- upper-cased email still signs in ---
  await page.context().clearCookies();
  await signIn(EMAIL.toUpperCase(), PASSWORD);
  check('email is case-insensitive', /\/admin$/.test(page.url()), page.url());

  // --- signed out is bounced back to login ---
  await page.context().clearCookies();
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  check('signed out is redirected to login', /\/admin\/login/.test(page.url()), page.url());

  // --- route-group guard: nothing admin on a public URL ---
  const leaked = await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  check('no admin page leaked to /login', leaked?.status() === 404, String(leaked?.status()));

  // --- the real account must be untouched ---
  check('real admin account untouched', !!(await users.findOne({ email: REAL_ACCOUNT })));
} finally {
  await browser.close();
  await users.deleteOne({ email: EMAIL });
  await client.close();
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILING CHECK(S)`}`);
process.exit(failures === 0 ? 0 : 1);
