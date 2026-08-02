# Admin Phase 1a — Login, Session, and Dashboard Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/admin/login` work end to end — sign in with the seeded account, land on a dashboard inside the admin shell, and sign out.

**Architecture:** Pages live under `app/(admin)/admin/**` because a route group contributes no URL segment. Authentication reuses the helpers already in `lib/admin/auth.ts` (signed httpOnly JWT via `jose`); this plan adds only credential verification and UI. Forms use Server Actions with `useActionState` so validation errors render inline. The sidebar chrome is a component (`AdminShell`) rather than a nested layout, so the login page can opt out of it.

**Tech Stack:** Next.js 16.2.12 (App Router, Turbopack), React 19.2.4, TypeScript, MongoDB driver 7, `bcryptjs`, `jose`, Playwright 1.62 for browser tests.

## Global Constraints

- **Route group adds no URL segment.** Admin pages MUST live under `app/(admin)/admin/**`. `app/(admin)/login/page.tsx` would resolve to `/login`, collide with the public site, and bypass the `/admin/:path*` middleware matcher. Verified in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`.
- **Do not modify `middleware.ts`.** It already guards `/admin/*` and exempts `/admin/login`. Server Actions POST to the page's own URL, which is exempt.
- **Do not modify `app/(admin)/admin.css`.** All 412 lines exist already; markup must match its class names (`.a-login`, `.a-shell`, `.a-sidebar`, `.a-card`, `.a-field`, `.a-input`, `.a-btn`, `.a-msg-error`, `.a-stat`, `.a-nav-link`, `.a-nav-count`, `.a-sidebar-footer`, `.a-header`, `.a-grid`).
- **`redirect()` must be called OUTSIDE `try/catch`.** It throws `NEXT_REDIRECT`; calling it inside a `try` swallows the redirect. Per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`.
- **Tests never import the TypeScript app code.** Verified: no script in this repo does, and no TS runner is installed (`tsx`/`ts-node` absent, and `--experimental-strip-types` does not exist on this Node v20.19.0). Test behaviour over HTTP with Playwright, or against Mongo directly — the two conventions already in use.
- **Never reset the real admin password.** The seeded account is `admin@upitcollege.com` and only the user knows its password. Tests MUST create and delete their own throwaway account.
- **Pass the dev-server origin to every test.** `next dev` walks up from 3000, and port 3000 on this machine often runs an unrelated project (AiSensy). Tests take a base URL argument and MUST refuse to run against the wrong app.
- **Admin must not load site assets.** No `styles.css`, no vendor scripts, no site chrome inside `(admin)`.
- **Login failures must be generic.** Always "Invalid email or password." — never reveal whether the email exists.

---

### Task 1: Login, session cookie, and credential verification

**Files:**
- Create: `lib/admin/login.ts`
- Create: `app/(admin)/admin/login/actions.ts`
- Create: `app/(admin)/admin/login/LoginForm.tsx`
- Create: `app/(admin)/admin/login/page.tsx`
- Test: `tests/admin-login.mjs`

**Interfaces:**
- Consumes: `getDb()` from `lib/mongodb.ts`; `createSessionToken`, `setSessionCookie`, `getSession` from `lib/admin/auth.ts`.
- Produces: `verifyCredentials(email: string, password: string): Promise<boolean>` in `lib/admin/login.ts`; a working `/admin/login`. Task 3 relies on `getSession()` returning `{ email }` after a successful sign-in.

Credential verification and the login page ship as one task because the only way to
exercise `verifyCredentials` in this repo is through the page — see the
"tests never import the TypeScript app code" constraint. Splitting them would
leave a task with no runnable test.

- [ ] **Step 1: Write the failing test**

Create `tests/admin-login.mjs`:

```js
/**
 * End-to-end admin login.
 *
 *   node tests/admin-login.mjs http://localhost:3001
 *
 * Creates a throwaway admin account and deletes it afterwards: the real
 * account's password is known only to the user and must never be reset. Also
 * covers what would otherwise be unit tests of verifyCredentials (wrong
 * password, unknown email, case-insensitive email), because nothing in this repo
 * can import the TypeScript module directly.
 */
import { chromium } from '@playwright/test';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

const BASE = process.argv[2] ?? process.env.LOCAL_ORIGIN ?? 'http://localhost:3000';
const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const DB = process.env.MONGODB_DB ?? 'upitcollege';
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

/** Submit the form and wait for either an error or a navigation. */
async function signIn(email, password) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(600);
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
    process.exit(2);
  }
  check('login page returns 200', first.status() === 200);

  // --- wrong password ---
  await signIn(EMAIL, 'definitely-wrong');
  let err = (await page.textContent('.a-msg-error').catch(() => null))?.trim() ?? '';
  check('wrong password shows an error', !!err, err);
  check('message is generic', /invalid email or password/i.test(err), err);
  check('still on the login page', /\/admin\/login/.test(page.url()), page.url());
  let cookies = await page.context().cookies();
  check('no session cookie after failure', !cookies.some((c) => c.name === 'upit_admin_session'));

  // --- unknown email: identical message, no enumeration ---
  await signIn('nobody@example.invalid', PASSWORD);
  const err2 = (await page.textContent('.a-msg-error').catch(() => null))?.trim() ?? '';
  check('unknown email is rejected', !!err2, err2);
  check('unknown email message is identical to wrong password', err2 === err, `${err2} vs ${err}`);

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

  // --- signing in again with an upper-cased email still works ---
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/admin-login.mjs http://localhost:3001`
Expected: exits 2 with `FATAL: .../admin/login did not serve this project's login page (status 404 ...)`.

- [ ] **Step 3: Write credential verification**

Create `lib/admin/login.ts`:

```ts
import { getDb } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

/**
 * Verify an admin's email and password.
 *
 * Returns a plain boolean rather than the user document: callers only need the
 * yes/no, and not returning the record keeps the bcrypt hash out of wider scope.
 *
 * Email is lower-cased before lookup because `seed-admin.mjs` stores whatever was
 * typed on the command line and operators are inconsistent about case. A bcrypt
 * comparison runs against a dummy hash when the account is missing, so a wrong
 * email and a wrong password take indistinguishable time.
 */

/** bcrypt hash of a value nobody can supply; keeps failure timing uniform. */
const DUMMY_HASH = '$2b$12$eImiTXuWVxfM37uY4JANjQ.Xa2HdrLAeC5cFCDqXK7Fz1I8N9Q4Ry';

type AdminUser = { email: string; passwordHash: string };

export async function verifyCredentials(email: string, password: string): Promise<boolean> {
  const normalised = email.trim().toLowerCase();
  if (!normalised || !password) return false;

  const db = await getDb();
  const user = await db
    .collection<AdminUser>('adminUsers')
    .findOne({ email: normalised }, { projection: { _id: 0, passwordHash: 1 } });

  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  return Boolean(user) && ok;
}
```

The seeded account uses the default lower-case `admin@upitcollege.com`, so the
lower-cased lookup matches it. If a mixed-case address ever lands in the
collection, normalise it with a one-off `updateOne` rather than removing this.

- [ ] **Step 4: Write the server action**

Create `app/(admin)/admin/login/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { verifyCredentials } from '@/lib/admin/login';
import { createSessionToken, setSessionCookie } from '@/lib/admin/auth';

export type LoginState = { error: string | null };

/**
 * Sign in.
 *
 * A Server Action rather than a route handler: it POSTs to the page's own URL,
 * which PUBLIC_PATHS in middleware.ts already exempts, so no separate
 * /admin/api/login endpoint is needed.
 *
 * `redirect()` throws NEXT_REDIRECT, so it is called after all awaited work and
 * never inside a try/catch — otherwise the redirect is swallowed and the user
 * sits on the login page while holding a valid session.
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');

  if (!email || !password) return { error: 'Invalid email or password.' };

  const ok = await verifyCredentials(email, password);
  // Deliberately identical for an unknown email and a wrong password.
  if (!ok) return { error: 'Invalid email or password.' };

  await setSessionCookie(await createSessionToken(email.trim().toLowerCase()));

  // Only internal admin destinations, so ?next= cannot become an open redirect.
  const destination =
    next.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin';
  redirect(destination);
}
```

- [ ] **Step 5: Write the client form**

Create `app/(admin)/admin/login/LoginForm.tsx`:

```tsx
'use client';

import { useActionState } from 'react';
import { login, type LoginState } from './actions';

const INITIAL: LoginState = { error: null };

/**
 * A Client Component so `useActionState` can render the validation error inline
 * instead of round-tripping through a query parameter.
 */
export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, INITIAL);

  return (
    <form action={formAction}>
      {state.error ? (
        <p className="a-msg a-msg-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <input type="hidden" name="next" value={next} />

      <div className="a-field">
        <label htmlFor="email">Email</label>
        <input
          className="a-input"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </div>

      <div className="a-field">
        <label htmlFor="password">Password</label>
        <input
          className="a-input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <button
        className="a-btn a-btn-primary"
        type="submit"
        disabled={pending}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Write the page**

Create `app/(admin)/admin/login/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import LoginForm from './LoginForm';

export const metadata = {
  title: 'Sign in — UPIT College of Education Admin',
  robots: { index: false, follow: false },
};

/** Reads the session cookie, so never prerendered. */
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = '' } = await searchParams;

  // Already signed in — no reason to show the form.
  const session = await getSession();
  if (session) redirect('/admin');

  return (
    <div className="a-login">
      <div className="a-card">
        <h1>UPIT College of Education</h1>
        <p className="sub">Sign in to manage colleges, courses and leads.</p>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run the test — expect only the dashboard checks to fail**

Run: `node tests/admin-login.mjs http://localhost:3001`
Expected: the login-page, wrong-password, unknown-email, cookie and `/login`-404 checks PASS. These FAIL because `/admin` does not exist until Task 3:
`redirected to the dashboard`, `dashboard reachable when signed in`, `email is case-insensitive`.
Confirm no other check fails.

- [ ] **Step 8: Commit**

```bash
git add lib/admin/login.ts "app/(admin)/admin/login" tests/admin-login.mjs
git commit -m "feat(admin): add login page, credential check and session cookie"
```

---

### Task 2: Admin shell and logout

**Files:**
- Create: `app/(admin)/admin/logout/actions.ts`
- Create: `components/admin/AdminShell.tsx`

**Interfaces:**
- Consumes: `clearSessionCookie` from `lib/admin/auth.ts`.
- Produces: `logout(): Promise<void>`; `NavCounts = { colleges: number; courses: number; pages: number; leads: number }`; and `<AdminShell current email counts title subtitle? actions? children />`. Task 3 and every later admin page render inside this shell.

A component rather than a nested layout: a layout at `app/(admin)/admin/layout.tsx`
would also wrap `/admin/login`, which must render the bare centred `.a-login` card
with no sidebar.

- [ ] **Step 1: Write the logout action**

Create `app/(admin)/admin/logout/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { clearSessionCookie } from '@/lib/admin/auth';

/** `redirect()` throws NEXT_REDIRECT, so it stays outside any try/catch. */
export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect('/admin/login');
}
```

- [ ] **Step 2: Write the shell**

Create `components/admin/AdminShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import { logout } from '@/app/(admin)/admin/logout/actions';

/**
 * Sidebar + main chrome for every signed-in admin page.
 *
 * Class names come from app/(admin)/admin.css, which is already written in full —
 * match it rather than inventing new classes.
 */
export type NavCounts = {
  colleges: number;
  courses: number;
  pages: number;
  leads: number;
};

const NAV: { key: keyof NavCounts; label: string; href: string }[] = [
  { key: 'colleges', label: 'Colleges', href: '/admin/colleges' },
  { key: 'courses', label: 'Courses', href: '/admin/courses' },
  { key: 'pages', label: 'Pages', href: '/admin/pages' },
  { key: 'leads', label: 'Leads', href: '/admin/leads' },
];

export default function AdminShell({
  current,
  email,
  counts,
  title,
  subtitle,
  actions,
  children,
}: {
  current: 'dashboard' | keyof NavCounts;
  email: string;
  counts: NavCounts;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="a-shell">
      <nav className="a-sidebar">
        <div className="a-brand">
          SRM <span>Admin</span>
        </div>

        <a className={`a-nav-link${current === 'dashboard' ? ' active' : ''}`} href="/admin">
          Dashboard
        </a>

        {NAV.map((item) => (
          <a
            key={item.key}
            className={`a-nav-link${current === item.key ? ' active' : ''}`}
            href={item.href}
          >
            <span>{item.label}</span>
            <span className="a-nav-count">{counts[item.key]}</span>
          </a>
        ))}

        <div className="a-sidebar-footer">
          <div style={{ marginBottom: 8 }}>{email}</div>
          <form action={logout}>
            <button className="a-btn" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <main className="a-main">
        <header className="a-header">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </header>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/types" | head`
Expected: no output. Errors under `.next/types/` are pre-existing stale generated files, unrelated to this change.

- [ ] **Step 4: Commit**

```bash
git add components/admin/AdminShell.tsx "app/(admin)/admin/logout"
git commit -m "feat(admin): add sidebar shell and logout action"
```

---

### Task 3: Dashboard

**Files:**
- Create: `lib/admin/counts.ts`
- Create: `app/(admin)/admin/page.tsx`

**Interfaces:**
- Consumes: `getSession` from `lib/admin/auth.ts`; `AdminShell` and `NavCounts` from Task 2.
- Produces: `getCounts(): Promise<NavCounts>`. Later phases reuse it for their own nav badges.

- [ ] **Step 1: Write the counts helper**

Create `lib/admin/counts.ts`:

```ts
import { getDb } from '@/lib/mongodb';
import type { NavCounts } from '@/components/admin/AdminShell';

/**
 * Record counts for the sidebar badges and dashboard tiles.
 *
 * `pages` excludes the 20 university-family records: those are the college
 * detail pages, already counted under colleges, and counting them twice would
 * overstate how much generic content exists.
 */
export async function getCounts(): Promise<NavCounts> {
  const db = await getDb();
  const [colleges, courses, pages, leads] = await Promise.all([
    db.collection('universities').countDocuments(),
    db.collection('courses').countDocuments(),
    db.collection('pages').countDocuments({ family: { $ne: 'university' } }),
    db.collection('leads').countDocuments(),
  ]);
  return { colleges, courses, pages, leads };
}
```

- [ ] **Step 2: Write the dashboard page**

Create `app/(admin)/admin/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/auth';
import { getCounts } from '@/lib/admin/counts';
import AdminShell from '@/components/admin/AdminShell';

export const metadata = {
  title: 'Dashboard — UPIT College of Education Admin',
  robots: { index: false, follow: false },
};

/** Reads the session cookie and live counts, so never prerendered. */
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Middleware already guards /admin, but a page rendering private data verifies
  // its own session rather than trusting an upstream check.
  const session = await getSession();
  if (!session) redirect('/admin/login?next=%2Fadmin');

  const counts = await getCounts();

  const tiles: { label: string; value: number }[] = [
    { label: 'Colleges', value: counts.colleges },
    { label: 'Courses', value: counts.courses },
    { label: 'Pages', value: counts.pages },
    { label: 'Leads', value: counts.leads },
  ];

  return (
    <AdminShell
      current="dashboard"
      email={session.email}
      counts={counts}
      title="Dashboard"
      subtitle="Manage the public site's content."
    >
      <div className="a-grid">
        {tiles.map((t) => (
          <div className="a-card a-stat" key={t.label}>
            <div className="a-stat-label">{t.label}</div>
            <div className="a-stat-value">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="a-card a-card-pad">
        <p style={{ margin: 0, color: 'var(--a-muted)' }}>
          College management arrives next. Courses, pages and leads follow in later phases,
          so those sidebar links are not live yet.
        </p>
      </div>
    </AdminShell>
  );
}
```

- [ ] **Step 3: Run the login test — now fully green**

Run: `node tests/admin-login.mjs http://localhost:3001`
Expected: `ALL PASS`, exit 0. In particular `dashboard reachable when signed in` returns 200, `redirected to the dashboard` passes, and `no admin page leaked to /login` is 404.

- [ ] **Step 4: Verify the tiles against the database**

Run:
```bash
node -e "
const {MongoClient}=require('mongodb');
(async()=>{const c=await new MongoClient('mongodb://127.0.0.1:27017').connect();
const d=c.db('upitcollege');
console.log('colleges',await d.collection('universities').countDocuments());
console.log('courses ',await d.collection('courses').countDocuments());
console.log('pages   ',await d.collection('pages').countDocuments({family:{\$ne:'university'}}));
console.log('leads   ',await d.collection('leads').countDocuments());
await c.close();})()"
```
Expected: `colleges 19`, `courses 49`, `pages 93`, `leads 5` — verified against the live database on 2026-08-01. The four dashboard tiles and the sidebar badges must show these same numbers.

- [ ] **Step 5: Confirm no regression on the public site**

Run: `node tests/compare-flow.mjs http://localhost:3001`
Expected: `ALL PASS`. Admin work must not affect the public site.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v "^\.next/types" | head`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add "app/(admin)/admin/page.tsx" lib/admin/counts.ts
git commit -m "feat(admin): add dashboard with live record counts"
```

---

### Task 4: Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document how to sign in**

Append to `README.md`:

````markdown
## Admin

The admin lives at `/admin`, guarded by `middleware.ts`. It uses a separate root
layout and loads none of the public site's CSS or vendor scripts.

Create the account and session secret (the password is printed once):

```bash
node scripts/seed-admin.mjs                      # first run
node scripts/seed-admin.mjs --reset              # new password, same account
node scripts/seed-admin.mjs --email you@site.com # a different account
```

Then sign in at `/admin/login`.

Mind the dev-server port: `next dev` moves up from 3000 when it is taken, so the
admin is often at `http://localhost:3001/admin`. The test scripts take the origin
as their first argument and refuse to run against a different app:

```bash
node tests/admin-login.mjs http://localhost:3001
node tests/compare-flow.mjs http://localhost:3001
```

Admin pages live under `app/(admin)/admin/**`. The `(admin)` route group
contributes no URL segment, so the extra `admin/` folder is what produces the
`/admin` prefix — moving a page up one level would put it on a public URL and
bypass the middleware entirely.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: explain admin sign-in and the (admin)/admin route nesting"
```

---

## Self-Review

**Spec coverage for Phase 1a.** §6.1 route table — Tasks 1 and 3, with
`/admin/api/login` and `/admin/api/logout` dropped: a Server Action POSTs to the
page's own URL, which middleware already exempts, so the endpoints are redundant
(recorded in Task 1's action docstring). §6.4 auth flow — Task 1, including the
generic failure message, `?next=` handling, and open-redirect rejection. §6.3
boundaries — `lib/admin/login.ts` (credentials), `lib/admin/counts.ts` (counts),
`components/admin/AdminShell.tsx` (chrome), each one responsibility. §8
route-resolution test — Task 1's `no admin page leaked to /login`.

**Not in this plan, by design.** College CRUD, `UniversityDetail`, the DB-driven
`/university` listing, `renderUniversityCard`, `compareId` allocation, HTML
sanitisation, and the migration of the 19 colleges — all Phase 1b/1c with their
own plans. The sidebar links to `/admin/colleges`, `/admin/courses`,
`/admin/pages` and `/admin/leads` will 404 until then; the dashboard says so
explicitly rather than leaving it a surprise.

**Type consistency.** `NavCounts` is declared once in `AdminShell.tsx` and
imported by `lib/admin/counts.ts`; `getCounts()` returns exactly its four keys,
which match the `NAV` table's `key` values and the dashboard's four tiles.
`LoginState` is declared in `actions.ts` and imported by `LoginForm.tsx`.
`verifyCredentials(email, password): Promise<boolean>` has one signature, used in
Task 1 Step 3 and Step 4. `getSession()` returns `{ email }`, which is what
`AdminShell`'s `email` prop receives and what the dashboard passes.

**Resolved before writing, not left to execution.** The first draft split
credential verification into its own task with a unit test importing
`lib/admin/login.ts`. That test could not run: `tsx` and `ts-node` are absent,
`--experimental-strip-types` does not exist on Node v20.19.0, and no existing
script in this repo imports the TS app code. The tasks were merged and those
cases moved into the Playwright test, matching the repo's actual convention.
