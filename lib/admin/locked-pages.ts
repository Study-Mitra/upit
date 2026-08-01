/**
 * Page families the admin deliberately does not expose, and why.
 *
 * Shared so the sidebar badge, the dashboard tile and the Pages list all agree —
 * a count that includes pages you cannot open reads as a bug.
 *
 * `university` — those 20 documents are the pre-migration college blobs, retained
 *   only as a rollback for scripts/migrate-universities.mjs. Colleges render from
 *   the `universities` collection now, so editing the blob would appear to work
 *   and change nothing on the site.
 * `root` — the homepage renders from components/pages/HomeContent.tsx, not this
 *   collection.
 * `compare-university` — carries the `#course_id` <select> that the
 *   `courseCategories` lookup was recovered from; editing it risks breaking the
 *   comparison dropdowns.
 */
export const LOCKED_PAGE_FAMILIES = ['university', 'root', 'compare-university'] as const;

export const LOCKED_PAGE_FAMILY_SET: ReadonlySet<string> = new Set(LOCKED_PAGE_FAMILIES);

/** Mongo filter matching only the pages the admin can actually edit. */
export const EDITABLE_PAGES_FILTER = {
  family: { $nin: [...LOCKED_PAGE_FAMILIES] },
} as const;
