/**
 * Refuse saves that would destroy most of a field.
 *
 * The visual editor can only keep markup its schema understands, and this site's
 * content is imported theme markup. Opening a page in it and saving once turned
 * 87,604 characters into 15,718 — an 82% loss written straight to the database.
 * The UI now warns, but a warning is not a guarantee: this is the backstop that
 * makes the loss impossible rather than merely discouraged.
 *
 * Deliberately not a blanket "content must not shrink" rule — deleting a section
 * on purpose is normal. It triggers only on a collapse: most of a substantial
 * field disappearing at once.
 */

/** Fields below this are too small for a percentage to mean anything. */
const MIN_SIGNIFICANT = 800;

/** Reject when a substantial field loses more than this share of its content. */
const MAX_SHRINK = 0.5;

export type ShrinkCheck = { ok: true } | { ok: false; message: string };

export function checkNoCollapse(
  fields: { label: string; before: string; after: string }[]
): ShrinkCheck {
  for (const f of fields) {
    const before = (f.before ?? '').length;
    const after = (f.after ?? '').length;
    if (before < MIN_SIGNIFICANT) continue;
    if (after >= before * (1 - MAX_SHRINK)) continue;

    const pct = Math.round((1 - after / before) * 100);
    return {
      ok: false,
      message:
        `Refused: "${f.label}" would lose ${pct}% of its content ` +
        `(${before.toLocaleString()} → ${after.toLocaleString()} characters). ` +
        `This usually means the Visual editor dropped layout it cannot represent. ` +
        `Switch that field to the HTML tab and edit the source directly. ` +
        `If you really do mean to delete this much, remove it in the HTML view in smaller steps.`,
    };
  }
  return { ok: true };
}
