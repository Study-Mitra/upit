/**
 * Shared registry for inline `!important` style blocks.
 *
 * React's style prop silently drops !important, so the converter strips those
 * blocks off the element (tagging it data-pxs="<hash>") and records the original
 * declarations here. They are re-emitted as high-specificity CSS rules in
 * public/assets/css/pixel-inline.css, which the layout loads AFTER styles.css.
 *
 * Tokens are content hashes, so every generator run contributes to the same
 * deduplicated set without collisions.
 */
import { readFile, writeFile } from 'node:fs/promises';

const REGISTRY = new URL('../../data/important-styles.json', import.meta.url);
const CSS_OUT = new URL('../../public/assets/css/pixel-inline.css', import.meta.url);

async function readRegistry() {
  try {
    return JSON.parse(await readFile(REGISTRY, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Merge newly generated rules into the registry and rewrite the stylesheet.
 * @param {string[]} rules CSS rule strings from htmlToJsx().importantStyles
 * @param {string} source label for provenance in the registry
 */
export async function mergeImportantStyles(rules, source) {
  const registry = await readRegistry();
  let added = 0;

  for (const rule of rules) {
    const token = rule.match(/\[data-pxs="([^"]+)"\]/)?.[1];
    if (!token) continue;
    if (!registry[token]) {
      registry[token] = { rule, sources: [source] };
      added++;
    } else if (!registry[token].sources.includes(source)) {
      registry[token].sources.push(source);
    }
  }

  await writeFile(REGISTRY, JSON.stringify(registry, null, 2), 'utf8');

  const header = `/* GENERATED — do not hand-edit. Regenerate via the gen-* scripts.
 *
 * Every rule here replaces an inline style="... !important" block from the live
 * markup. React cannot express !important in its style prop, so the declarations
 * are preserved verbatim as CSS instead.
 *
 * The [data-pxs] selector is repeated to reach specificity (0,4,0), beating the
 * most specific competing !important rule in styles.css
 * (.active-dark-mode .rbt-badge.variation-02, at (0,3,0)).
 *
 * This file MUST load after styles.css.
 */\n\n`;

  const css =
    header +
    Object.keys(registry)
      .sort()
      .map((t) => registry[t].rule)
      .join('\n') +
    '\n';

  await writeFile(CSS_OUT, css, 'utf8');
  return { added, total: Object.keys(registry).length };
}
