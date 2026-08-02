/**
 * Escape a plain string for interpolation into an HTML fragment.
 *
 * Needed where a container's innerHTML is composed from data (e.g. a heading
 * built alongside a stored WYSIWYG blob). Course names contain "&", which must
 * round-trip as "&amp;" to match the live markup byte-for-byte.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
