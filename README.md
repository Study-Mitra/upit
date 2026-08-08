This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

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
as their first argument and refuse to run against a different app rather than
reporting confusing failures:

```bash
node tests/admin-login.mjs http://localhost:3001
node tests/compare-flow.mjs http://localhost:3001
```

Admin pages live under `app/(admin)/admin/**`. The `(admin)` route group
contributes no URL segment, so the extra `admin/` folder is what produces the
`/admin` prefix — moving a page up one level would put it on a public URL and
bypass the middleware entirely.

Sign-in is a Server Action, not a route handler: it POSTs to the page's own URL,
which `PUBLIC_PATHS` already exempts, so no `/admin/api/login` endpoint exists.

### Status

Built: login, session, sidebar shell, dashboard counts.
Not yet built (the sidebar links 404): colleges, courses, pages, leads. See
`docs/superpowers/specs/` and `docs/superpowers/plans/`.
# upit
