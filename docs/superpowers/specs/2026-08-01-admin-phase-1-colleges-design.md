# Admin Phase 1 — Login, Shell, and College Management

**Date:** 2026-08-01
**Status:** Approved for planning
**Scope:** Phase 1 of 4. Later phases (leads, courses, pages) get their own specs.

---

## 1. Problem

The admin area is scaffolding with no rooms. `app/(admin)/` contains only
`layout.tsx` and `admin.css`. `middleware.ts` guards `/admin/*` and redirects to
`/admin/login`, **which does not exist** — so `/admin` currently 307s to a 404.
`lib/admin/auth.ts` and one seeded `adminUsers` record are ready and unused.

Adding a college today requires hand-writing two Mongo documents:

1. a `universities` record (16 fields including `compareId`, `cardHtml`,
   `courseIds`, `modeIds`), and
2. a `pages` record whose `contentHtml` is the **entire detail page** as one
   18–103 KB HTML blob.

That blob is the reason content cannot be added without an engineer.

Worse, even a correctly hand-written record **appears nowhere**: `/university` is
itself a 104 KB blob with all 19 cards hardcoded, and the homepage has 12 more.
Only the `/compare-university` dropdowns read the collection.

## 2. Goals

- Log in at `/admin/login` and reach a working admin shell.
- Create, edit, and delete a college through a form — no HTML authoring.
- A new college appears on `/university`, in the compare dropdowns, and at its
  own detail page, immediately after save.
- Migrate the 19 existing colleges into the new field structure with **no visual
  change** to their public pages.
- Do not break the comparison feature, the listing filters, or `/compare/*`.

## 3. Scope boundaries

**Committed, in later phases (see §10).** Leads, courses, and generic pages
(blog/specialization/static) are all in scope for the admin as a whole. They are
sequenced after Phase 1 rather than dropped, because each needs its own data
decisions and Phase 1 is the prerequisite (login, shell, and the field-migration
pattern all get reused).

**Excluded by decision, not by phasing:**
- **File uploads.** Media arrives as URLs and is stored as strings. No multipart
  handling, no `sharp` pipeline, no writes to `public/uploads/`.
- **Draft/publish states.** Saves go live immediately with `revalidatePath`.

**Deferred with reason.** The homepage's 12 hardcoded "featured" cards. The
curation rule (which 12 of 19, in what order) is not recoverable from the data,
so converting them would require inventing it. Needs a `featured` flag plus a
sort order, decided deliberately.

### 3.1 Data repairs included in Phase 1

Both known data gaps are fixed here rather than surfaced and left:

- **`excerpt` is empty on all 19.** Migration extracts it from the hero block, so
  this is repaired as a side effect of §5.3.
- **`courseIds` is empty on 9 of 19 colleges**, so they never match
  `/filter-course` and render an empty Courses carousel.

  **No automatic backfill is possible.** Verified: `swiper-slide` count in the
  Courses section equals `courseIds.length` on all 19 pages, so the carousel is
  rendered *from* `courseIds`. The 9 colleges with an empty relation also have an
  empty (0.7 KB) Courses section — there is no independent record of which courses
  they offer, in the blob or anywhere else. Any "backfill" would be invention.

  The real fix is therefore a product one: the college form exposes a course
  multi-select, and the admin list flags these 9 as incomplete so they can be
  assigned deliberately. They are:
  `dy-patil-pune`, `dy-patil-mumbai`, `gla-online`, `georgia-university`,
  `sikkim-manipal-university`, `arka-jain-university`, `mata-tripura-sundari`,
  `swami-vivekanand-subharti`, `mats-university`.

---

## 4. Key design finding

Section *shape* is not consistent across the 19 pages. Arka Jain renders Key
Features as a `<table>` but Admission Process as a `<ul>`; CU Online uses tables
for Key Features, Admission, Career and Reviews. The **Courses** section is not
text at all — it is a Swiper carousel of course cards built from the `courseIds`
relation.

Fully typing all seven sections would force one presentation and visibly change
several pages. Instead, sections whose shape is uniform become structured
fields, and sections whose shape varies become **per-section rich text**. This
keeps a real admin form (no single giant blob, each section independently
editable) while letting migration preserve each section's inner HTML verbatim.

**Consequence: migration is a split, not a re-render.** Visual risk is near zero.

---

## 5. Data model

### 5.1 `universities` — authored fields

All 19 pages carry the same seven sections, in this order. Two pages have extra
headings beyond them (§5.3), so "seven" describes the shared template, not a
literal `<h4>` count on every page.

| Section | Field | Type | Rationale |
|---|---|---|---|
| About *{Name}* | `about` | rich text HTML | prose on all 19 |
| Approvals *{Name}* | `approvals` | `{label, logoUrl}[]` | **structured** — image + caption on all 19 |
| Courses | `courseIds` | `string[]` relation | already exists; drives the course carousel |
| Key Features | `keyFeatures` | rich text HTML | table on some, list on others |
| Admission Process | `admissionProcess` | rich text HTML | table vs `<ul>` varies |
| Career Process | `careerProcess` | rich text HTML | table vs list+prose varies |
| Reviews | `reviews` | rich text HTML | table vs single paragraph varies |

Plus the hero and identity fields, all of which already exist except `banner`:

| Field | Type | Notes |
|---|---|---|
| `slug` | string | unique; immutable after create (URLs depend on it) |
| `path` | string | derived: `/university/{slug}` |
| `name` | string | |
| `detailName` | string | existing field, kept |
| `compareName` | string | label in compare dropdowns |
| `compareId` | string | **auto-allocated** on create; immutable |
| `logo` | URL string | |
| `banner` | URL string | **new field** — hero and card both need it |
| `location` | string | |
| `excerpt` | string | hero intro; **currently empty for all 19**, populated by migration |
| `modeIds` | `string[]` | drives `/filter-mode-study` |
| `seo` | `{title, description, keywords}` | |

### 5.2 Derived fields — written on save, never hand-edited

- **`cardHtml`** — must keep existing. `/filter-course`, `/filter-price` and
  `/filter-mode-study` each return `unis.map(u => u.cardHtml).join('\n')` to the
  browser. Regenerating it from the structured fields on every save keeps all
  three endpoints working **unchanged**, and the listing card markup lives in
  exactly one place.
- **`badges`** — `approvals.map(a => a.label)`. `approvals` is authoritative;
  `badges` stays denormalized so existing card/compare consumers are untouched.
- **`elementId`** — `uni-{compareId}`, matching current data.

A single `renderUniversityCard(u): string` in `lib/admin/` is the sole producer
of card markup, used by the save path. Byte-compared against the existing 19
`cardHtml` values in tests to prove the generator is faithful.

The byte-comparison is valid precisely because `courseIds` and `modeIds` are left
untouched by migration (§3.1) — `cardHtml` embeds them as `data-courses` /
`data-modes`, so a backfill would have invalidated the baseline. Once an operator
later edits a college's courses, `cardHtml` changes legitimately; the test pins
the generator against today's data, not against all future output.

### 5.3 What migration writes, and from where

`contentHtml` is split at the seven `<h4>` boundaries. Section inner HTML is
copied **verbatim** into the five rich-text fields. From the ~6.9 KB block
preceding the first `<h4>` (uniform across pages: breadcrumb, badge pills, `h2`
name, location, intro paragraph, logo `<img>`, banner `<img>`) migration extracts
`excerpt` and `banner`. `approvals` logo URLs come from the `<img>` tags in the
Approvals section, paired with existing `badges` labels by position — and the
script **aborts that page with a report if the two counts differ**, since silent
positional pairing would mislabel logos.

The `pages` document for `/university/{slug}` is **deleted** once its university
record carries the fields, so there is one source of truth.

Two outliers need hand-checking after the script runs:
- **LPU** — 8 `<h4>` plus 2 accordions (an extra FAQ block).
- **VGU** — 16 `<h4>`; its admission steps are `<h4>`s, and it has an extra
  "Courses Offered at VGU" heading.

For both, the extra content is appended to the nearest owning section so nothing
is dropped; the script reports them for manual review rather than guessing.

---

## 6. Architecture

### 6.1 Routes

**A route group contributes no URL segment.** Verified against
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`:
*"should not be included in the route's URL path."* So pages must sit under an
inner `admin/` folder — `app/(admin)/login/page.tsx` would resolve to `/login`,
colliding with the site and never matching the middleware's `/admin/:path*`
matcher. The group exists only to provide the second root layout.

```
app/(admin)/
  layout.tsx                           exists — admin shell nav added
  admin.css                            exists
  admin/
    login/page.tsx                     -> /admin/login   (fixes the current 404)
    page.tsx                           -> /admin          dashboard: counts + links
    colleges/page.tsx                  -> /admin/colleges list, flags incomplete
    colleges/new/page.tsx              -> /admin/colleges/new
    colleges/[slug]/page.tsx           -> /admin/colleges/{slug}   edit
    api/login/route.ts                 -> POST /admin/api/login
    api/logout/route.ts                -> POST /admin/api/logout
    api/colleges/route.ts              -> POST create
    api/colleges/[slug]/route.ts       -> PUT update, DELETE
```

`PUBLIC_PATHS` in `middleware.ts` already exempts `/admin/login` and
`/admin/api/login`, and the matcher is already `/admin/:path*` — so with this
layout **no middleware change is needed**.

Two further constraints from the same docs, both already satisfied: multiple root
layouts require the home route to live inside a group (`app/(site)/page.tsx` ✓,
and the old top-level `app/layout.tsx` is already deleted), and no two groups may
resolve to the same path (`(site)` has no `admin/` folder ✓).

### 6.2 Public-site changes

- **`components/templates/UniversityDetail.tsx`** (new) — renders hero + the
  seven sections from fields. `app/(site)/university/[slug]/page.tsx` switches
  from `GenericPage` to this, reading `universities` instead of `pages`.
- **`app/(site)/university/page.tsx`** — stops rendering the 104 KB blob;
  iterates the collection and emits each card. The surrounding listing chrome
  (filter sidebar, headings) is preserved from the current blob as a wrapper
  component so filters keep working.
- **`lib/models/universities.ts`** — add `banner`, `approvals`, and the five
  section fields to the `University` type; add `createUniversity`,
  `updateUniversity`, `deleteUniversity`, `nextCompareId`.

### 6.3 Server boundaries

Form submission goes to route handlers under `app/(admin)/api/`, which are the
only writers. `lib/models/universities.ts` owns all Mongo access;
`lib/admin/validate.ts` owns field validation; `lib/admin/card.ts` owns card
generation. Each is independently testable and none imports the others' internals.

### 6.4 Auth flow

`POST /admin/api/login` → look up `adminUsers` by email → `bcrypt.compare` →
`createSessionToken` → `setSessionCookie` → redirect to `?next=` or `/admin`.
All helpers already exist in `lib/admin/auth.ts`; nothing new is invented.
Failures return a generic "Invalid email or password" — no account enumeration.

### 6.5 Cache revalidation

Saves go live immediately (decision). On create/update/delete, revalidate
`/university` and `/university/{slug}`.

Nothing else needs it, and it is worth being precise about why:
- `/compare/*` is already `force-dynamic`.
- The compare dropdowns are AJAX-fed from `/get-universities` at request time.
- The three listing filters are AJAX route handlers reading Mongo per request.
- **`/` is deliberately not revalidated.** The homepage's 12 university cards are
  hardcoded in `components/pages/HomeContent.tsx`, not read from the collection,
  so revalidating it would have no effect. A new college will not appear on the
  homepage until the deferred "featured" work lands (§3) — a known, accepted
  limitation of Phase 1 rather than an oversight.

`generateStaticParams` on the detail route keeps prerendering the known set;
unknown slugs render on demand, so a new college resolves without a rebuild.

---

## 7. Validation and error handling

- `slug` — required, `^[a-z0-9-]+$`, unique. Rejected with a field-level message,
  not a 500. Immutable on edit.
- `compareId` — never user-supplied. Allocated as `max(compareId) + 1`. Immutable.
- `name`, `logo`, `banner`, `location` — required. URL fields must parse as a
  path or absolute URL.
- `approvals[].logoUrl` — required per row; a row with a label and no logo would
  render a broken image in the Approvals section.
- Rich-text fields — sanitized on save (strip `<script>`, inline event handlers)
  before storage, since they are rendered with `dangerouslySetInnerHTML`.
- **Delete** — blocked with an explanatory error if the college is referenced by
  any course's `universitiesOffering.cards`, rather than leaving dangling cards.
- Mongo unavailable → the admin shows an error state; it must not render a
  half-saved form as success.

## 8. Testing

- **Card generator fidelity** — `renderUniversityCard` output compared against
  all 19 stored `cardHtml` values. This is the highest-value test: it proves the
  generator can replace hand-authored markup.
- **Migration idempotence** — running the script twice produces identical
  documents; a dry-run mode reports per-page section extraction counts and flags
  the LPU/VGU outliers.
- **Visual regression** — existing `scripts/visual-diff.mjs` over all 19
  `/university/{slug}` pages plus `/university`, before vs after migration. This
  is the acceptance gate for "no visual change."
- **Comparison flow** — existing `tests/compare-flow.mjs` must stay green;
  extended with a case that adds a college via the admin API and asserts it
  appears in the compare dropdowns with a valid `compareId`.
- **Auth** — unauthenticated `/admin/colleges` redirects to login; valid login
  sets the cookie and reaches the dashboard; wrong password is rejected.
- **CRUD round trip** — create → appears on `/university` and its detail page →
  edit a section → change is live → delete → 404s.
- **Route resolution** — assert `/admin/login` serves the login page and that no
  admin page is reachable at a public URL (`/login`, `/colleges`), guarding the
  route-group mistake found during spec review.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Card generator not byte-faithful → listing/filters shift | Byte-compare test against all 19 before switching the listing over |
| Migration loses content on the LPU/VGU outliers | Extra content appended to nearest section; script reports both for manual review; visual diff gate |
| Deleting the `pages` rows is destructive | Migration writes universities first, verifies, and only then deletes; `data/raw/*.html` remains as an independent recovery source |
| Rich-text fields are an XSS vector via `dangerouslySetInnerHTML` | Sanitize on save; admin is authenticated and non-public |
| Empty `courseIds` on 9 colleges → empty Courses carousel | Not auto-fixable — no source exists (§3.1). Admin exposes a course multi-select and flags the 9 as incomplete |
| `approvals` logo/label counts disagree on some page → mislabelled logos | Script aborts that page and reports rather than pairing silently |
| Route group misplacement puts admin pages on public URLs | Pages live under `app/(admin)/admin/**`; verified against the Next route-groups doc (§6.1) |

## 10. Phases after this one

All three are committed scope, each getting its own spec before implementation.

**Phase 2 — Leads.** The `leads` collection (5 records now, fed by
`/lead-submit`). List with filters, detail view, CSV export. Read-only, so no
validation or revalidation concerns. Smallest of the three.

**Phase 3 — Courses.** 49 records. The `Course` model is already structured
(`details[]`, `universitiesOffering.cards[]`, `seo`), so this is mostly form work
plus rich text for `descriptionHtml` and `faqHtml` — the model's own comment
already says "edited by the admin's rich-text editor". Two-way relation with
colleges: `universitiesOffering.cards` here versus `courseIds` there, currently
independent and able to disagree. That reconciliation is the main design question
and belongs in its own spec.

**Phase 4 — Pages.** 113 `pages` records across blog, specialization, and static
families. Per-family field structure, as `lib/models/pages.ts` anticipates
("will gain field-level structure in the admin phase"). Largest surface; benefits
most from the split-at-headings migration pattern proven in Phase 1.
