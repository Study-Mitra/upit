# Themeable design system — breaking the resemblance to the source site

Date: 2026-08-08
Status: approved (design), not yet implemented

## Problem

The site is a copy of `https://srmflexilearn.com/`. A previous pass
(`scripts/retheme.mjs`) swapped the colour hexes — orange `#ff7d00` + teal
`#045889` became gold `#c89200` + navy `#0b2350` — and the site still reads as
the same site.

Measured, not assumed. Fetching their stylesheet and stripping every colour
literal from both files:

```
theirs   948,340 bytes        ours   949,254 bytes
structural rule-block overlap   99.4%   (9,542 / 9,595 rules identical)
```

Our `styles.css` is their `styles.css` with hex substitutions. Their
`<link>` manifest is also identical, in the same order.

**Therefore: recolouring again cannot solve this.** Colour accounts for ~0.6% of
what the two files share. What makes a page read as "the same site" is the rest
— typeface, corner radius, shadow language, type scale, section rhythm.

A second, independent problem surfaced while measuring: the site self-hosts
**Euclid Circular A** (20 files in `public/assets/fonts/`, lifted from their
build). It is a commercial typeface from Swiss Typefaces. Serving it from our
domain requires a licence we do not hold. Replacing it fixes the licensing
exposure and is simultaneously the single largest visual differentiator.

## Goals

1. Stop the site resembling `srmflexilearn.com` — by changing what actually
   carries the resemblance, not the palette.
2. Give the admin a panel that changes the whole site's look, on every page.
3. Remove the unlicensed typeface.

## Non-goals

- Redesigning page layouts or information architecture. Section order, grids and
  component structure stay as they are; this changes their *rendering*, not
  their arrangement.
- Changing the brand palette away from navy + gold. See below.

## Key insight

Every lever we need is already declared in one `:root` block in
`public/assets/css/styles.css` (line 120):

```
--font-primary  --font-secondary  --font-alt        typography
--h1 … --h6  --font-size-b1..b4  --line-height-*    type scale
--radius  --radius-small  --radius-10  --radius-big  --border-width
--shadow-1..11  --shadow-primary  --dark-shadow-1..5
~90 colour variables
```

`--font-primary` cascades from `body`; changing that one token changes the
typography of every page. `--radius` is referenced 48 times, `--shadow-1` 69
times. So a single injected `:root` override block drives typography, shape,
elevation and colour together — one mechanism, four levers.

## Palette decision: navy + gold is kept

Sampled from the logo and all three home banners:

| asset | dominant brand hue | accent |
| --- | --- | --- |
| `upit_logo.png` | `#001848` navy, 14% of pixels | `#f0c060` gold, 1.7% |
| `banner1.webp` | `#001848` navy, 11% | `#e99c02` gold |
| `banner2.webp` | `#001848` navy, 11% | `#e99c02` gold |
| `banner3.webp` | `#001848` navy, 12% | `#e99c02` gold |

The source site is orange + teal. We are already far from them on hue, and
navy + gold is what our own logo and banners are. Recolouring away from the
logo would be wrong. The resemblance was never the colour.

One genuine colour defect is fixed, though. Today `--color-primary` is mustard
`#c89200` and is used as a **text colour 175 times**, at **2.3:1 against white
— below the WCAG AA 4.5:1 minimum**. That inversion is inherited from the
source, whose primary was a loud orange. In our own assets navy leads and gold
is a sparing accent, so the roles swap:

```
--color-primary        #0a2a63    navy — buttons, links, interactive
--color-primary-dark   #001a42    banner navy
--color-primary-light  #1c4a94
--color-accent         #e99c02    banner gold
--color-accent-light   #fbd162    logo highlight gold
--color-heading        #001a42
--color-surface        #f2f4f8
```

Navy on white is 16.8:1. Gold never becomes a text colour on white; it is used
as a **fill with navy text — 7.4:1**, which is what the logo itself does (gold
laurel on a navy shield).

## Direction: "Academic"

Chosen over Editorial and Contemporary. Best fit for a College of Education and
the furthest departure from the source's geometric-sans / 6px / soft-tinted-
shadow signature.

| token group | source site | new default |
| --- | --- | --- |
| heading font | Euclid Circular A (geometric sans) | **Source Serif 4** (serif) |
| body font | Euclid Circular A | **Source Sans 3** (humanist sans) |
| `--radius` | 6px | **4px** |
| `--radius-big` | 16px | **8px** |
| elevation | soft tinted shadows | **flat, 1px neutral borders** |

Both replacement families are SIL OFL licensed and will be self-hosted.

### Elevation without touching rules

`flat` is expressed entirely at the token level by making shadows spread-only:

```
--shadow-1: 0 0 0 1px var(--color-border);
```

A spread-only shadow renders as a border. No CSS rule anywhere needs editing,
and cards keep their definition once soft shadows are removed.

## Architecture

### 1. `lib/theme.ts` — the single source of truth

```ts
export type Theme = {
  palette:    { primary: string; accent: string; ink: string; surface: string };
  typography: { headingFont: FontId; bodyFont: FontId; scale: 'compact' | 'default' | 'spacious' };
  shape:      { radius: number; radiusBig: number; borderWidth: number };
  elevation:  'flat' | 'soft' | 'lifted';
  overrides:  Record<string, string>;   // advanced: raw token name -> value
};
```

Pure functions, no I/O:

- `derivePalette(palette)` → ~40 colour tokens, via HSL lightness/alpha steps
  (the `-dark`/`-light` variants, 10 opacity variants, 10 gradients, card and
  badge tints).
- `deriveTypography(typography)` → `--font-primary`, `--font-secondary`,
  `--font-alt`, `--h1..--h6`, `--font-size-b1..b4`, `--line-height-b1..b4`.
- `deriveShape(shape)` → the five radius/border tokens.
- `deriveElevation(elevation)` → `--shadow-1..11`, `--shadow-primary`,
  `--dark-shadow-1..5`.
- `themeCss(theme)` → a `:root { … }` string. `overrides` are applied last so a
  manual value always wins.
- `PRESETS` — named bundles of all four groups, including `academic` (the new
  default) and `legacy` (today's look, for one-click rollback).

Being pure and I/O-free means the same module renders the admin's live preview
and the public site, so the preview cannot drift from the result.

### 2. Storage

Mongo `settings` collection, document `{ _id: 'theme' }`, following the existing
`lib/models/*` pattern. `getTheme()` returns the stored theme, or a compiled-in
`DEFAULT_THEME` when absent, so a fresh database renders correctly.

`DEFAULT_THEME` is `PRESETS.legacy` in step 1 of the sequencing below — which
makes that step a visual no-op — and is changed to `PRESETS.academic` in step 3,
where the visible change is intended to land.

### 3. Injection

`themeCss()` output is rendered as `<style id="theme-vars">` **last in `<head>`**
in both `app/(site)/layout.tsx` and `app/(admin)/layout.tsx` — after
`STYLESHEETS` and after `CHROME_STYLE_BLOCKS`.

Safe with respect to the existing load-order constraints: those blocks and
`pixel-inline.css` use `!important` on *element* declarations, while this block
only defines custom properties on `:root`. They do not compete.

The site is statically generated. The layout reads the theme at build/ISR time
and the save action calls `revalidatePath('/', 'layout')`, so pages stay static.

### 4. Fonts

Both families are self-hosted under `public/assets/fonts/`, declared in a new
`public/assets/css/fonts-theme.css` added to `STYLESHEETS`. All theme font
choices are loaded regardless of which is active, so switching is instant.

**Constraint:** the admin font control is a dropdown over the shipped families,
not a free-text field. An arbitrary family name would silently fall back to a
system font with no error, which is a worse experience than a closed list.

Euclid Circular A — the 20 font files and `plugins/euclid-circulara.css` — is
deleted, and its `STYLESHEETS` entry removed.

### 5. `scripts/tokenize-colors.mjs` — making the theme actually reach everything

Today a `:root` override changes nothing in four of the six places colour lives.
Literals are rewritten to `var(--token, #literal)` — **keeping the original hex
as the CSS fallback**, so an undefined or malformed token degrades to exactly
today's rendering rather than to nothing.

Targets:

| file | scale |
| --- | --- |
| `public/assets/css/styles.css` | ~50 literals that bypass `:root` |
| `public/assets/css/compare-page.css` | fully hardcoded |
| `components/chrome/styleBlocks.ts` | generated `<style>` blocks |
| `public/assets/css/pixel-inline.css` | 6 generated rules |
| `app/(admin)/admin.css` | own two-var palette |
| Mongo `pages.contentHtml` | 189× `#1a2d5a`, 38× `#f5a623`, 164× `#f5f7fb` |
| Mongo `courses` | 114× `#1c273c`, 114× `#f8fafc`, 95× `#e7edf2` |
| Mongo `universities` | 72× `#f5f7fb`, 26× `#dee2e6` |

`var()` is valid inside inline `style` attributes, and `lib/admin/sanitize.ts`
preserves style attributes — verified — so tokenized content survives a re-save
from the visual editor.

Status colours (`#ef4444`, `#10b981`, `#3b82f6`, `#8b5cf6`, `#f59e0b`) are left
as literals. They are semantic, not brand.

The script writes `backups/pre-tokenize-2026-08-08.json` before touching the
database and supports `--revert`, matching the existing `backups/pre-rebrand-*`
convention. Dry-run by default, `--apply` to write, mirroring `retheme.mjs`.

### 6. `/admin/theme`

New sidebar entry in `components/admin/AdminShell.tsx` (`NAV` gains a `theme`
entry; note `NavCounts` is keyed per nav item, so the theme entry renders
without a count badge).

Controls:

- **Preset row** — one click sets all four groups.
- **Palette** — three colour pickers (primary, accent, ink) with hex fields.
- **Typography** — heading and body dropdowns over shipped families; scale
  selector.
- **Shape** — radius slider, border-width.
- **Elevation** — flat / soft / lifted.
- **Advanced** — a collapsible list of every derived token with its computed
  value, each overridable.
- **Live preview** — a strip rendering a button, heading, body paragraph, card,
  dark section and gold badge, styled by `themeCss()` in a scoped container.
- **Contrast readout** — computed ratio for each foreground/background pair,
  with a visible warning below 4.5:1. This is what stops the mustard-on-white
  defect from being reintroduced by hand.

Saved by a server action following `app/(admin)/admin/pages/actions.ts`:
`requireSession()`, validate, write, `revalidatePath('/', 'layout')`.

Values are validated server-side — hex colours matched against a strict pattern,
font ids against the shipped list, numerics range-clamped — because this value is
interpolated into a `<style>` tag on every page. An unvalidated string here
would be a CSS injection sink.

## Verification

The user's requirement is "make sure every page this change done", so that is
tested directly rather than asserted.

`tests/theme-switch.mjs` — Playwright, following the plain-script convention of
the existing `tests/*.mjs` (and taking a base URL argument, since `next dev`
walks up from 3000):

1. Set theme A, screenshot all **17** route templates under `app/(site)` at 2
   viewports (the 16 `page.tsx` files plus `not-found.tsx`), each dynamic route
   exercised with a real slug.
2. Set theme B (materially different palette and font), screenshot again.
3. Assert via `pixelmatch` that **every** template differs above a threshold.

A page that does not change is a page the tokenize pass missed. This converts
"did we get every page" from a judgement call into a pass/fail.

Screenshots are written under `backups/` (git-ignored working output), not
committed.

`tests/theme-contrast.mjs` — walks rendered text nodes on each template,
computes contrast against the resolved background, and fails on any body text
below 4.5:1. This is what would have caught the existing 2.3:1 mustard.

Existing suites (`admin-crud.mjs`, `admin-courses-pages.mjs`, `admin-login.mjs`,
`compare-flow.mjs`) must still pass.

## Risks

| risk | mitigation |
| --- | --- |
| DB rewrite is destructive | full backup before write, `--revert`, dry-run default, and `var(--t, #literal)` keeps the original hex as fallback |
| A missed literal leaves an element ignoring the theme | `theme-switch.mjs` fails on any template that does not change |
| Navy-on-navy CTAs — buttons vanishing on dark sections | dark sections flip CTAs to gold-fill / navy-text; caught by the screenshot review and the contrast test |
| Serif headings at existing `--h1: 52px` may set too large | type scale is a token group; adjusted during the screenshot review |
| Removing Euclid changes every text metric, shifting layout | reviewed per template in the screenshot pass; this is an accepted, intended change, not a regression |

## Sequencing

1. `lib/theme.ts` + settings model + injection — mechanism, no visible change
   (ships `legacy` preset so the site renders identically).
2. `scripts/tokenize-colors.mjs` — CSS then DB; still no visible change.
3. Fonts self-hosted; Euclid removed; `academic` preset becomes the default —
   the visible change lands here.
4. `/admin/theme`.
5. `theme-switch.mjs` + `theme-contrast.mjs`; screenshot review; fix fallout.

Each step is independently verifiable, and steps 1–2 are no-ops visually, so any
visual regression is attributable to step 3.
