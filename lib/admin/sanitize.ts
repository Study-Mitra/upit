/**
 * Strip executable content from admin-authored HTML.
 *
 * These fields are rendered with `dangerouslySetInnerHTML`, so anything that can
 * run must be removed at the point of storage rather than at the point of render
 * — a value written once is read on every page view.
 *
 * This is deliberately a denylist of the things that execute, not a full HTML
 * whitelist: the migrated content is arbitrary theme markup (tables, nested divs,
 * inline styles, feather icons) and a whitelist strict enough to be worth having
 * would strip legitimate layout. The admin is authenticated and single-user, so
 * the threat model is a mistaken paste, not a hostile author.
 */
export function sanitizeHtml(input: string): string {
  return String(input ?? '')
    // <script>, <iframe>, <object>, <embed> and friends, with or without a close.
    .replace(/<\s*(script|iframe|object|embed|noscript|template)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|noscript|template)\b[^>]*>/gi, '')
    // Inline event handlers: onclick=, onerror=, onload= ...
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    // javascript: URLs in href/src.
    .replace(/(href|src)\s*=\s*"(\s*javascript:[^"]*)"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'(\s*javascript:[^']*)'/gi, "$1='#'");
}

/** Plain-text field: collapse whitespace and drop any markup entirely. */
export function sanitizeText(input: string): string {
  return String(input ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
