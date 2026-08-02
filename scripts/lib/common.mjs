/** Shared constants and helpers for the crawl / mirror / extract pipeline. */

export const ORIGIN = 'https://srmflexilearn.com';

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** Politeness delay between requests, in ms. */
export const DELAY_MS = 300;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Map a URL path to a flat, filesystem-safe filename. '/' -> 'index'. */
export function safeName(path) {
  const clean = path.replace(/^\/+|\/+$/g, '');
  if (!clean) return 'index';
  return clean.replace(/[^a-zA-Z0-9._-]+/g, '__');
}
