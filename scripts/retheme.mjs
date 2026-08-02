/**
 * Re-colour the site to the UPIT brand palette.
 *
 *   node scripts/retheme.mjs            # dry run
 *   node scripts/retheme.mjs --apply
 *
 * WHY A COLOUR MAP AND NOT A REWRITTEN :root
 * styles.css defines ~90 colour variables and then hardcodes a handful of the
 * same values further down. Rewriting the :root block by hand would fix the
 * variables and leave the hardcoded copies behind, so the two would drift.
 * Mapping old hex -> new hex across the whole file catches both.
 *
 * PALETTE
 * Sampled from the supplied logo and hero banners:
 *   navy  #001848 / #00183c   dominant in both
 *   gold  #e49c00             the banner's accent
 *
 * The old theme was orange (#ff7d00) + teal-blue (#045889) with orange-tinted
 * neutrals. Hue is swapped rather than the structure: the accent stays the
 * accent, the dark stays the dark. `--color-primary` is used as a text colour
 * 175 times versus 87 as a background, so the accent is deepened from the
 * banner's #e49c00 to #c89200 — the raw banner gold sits near 2.4:1 against
 * white and would have made body copy harder to read than the orange it
 * replaces.
 *
 * styles.original.css is NOT touched: it is the pristine import kept for
 * reference.
 */
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url).pathname;
const APPLY = process.argv.includes('--apply');

/** old -> new. Order is irrelevant; every key is a distinct literal. */
const MAP = {
  // ---- accent: orange -> brand gold ----
  '#ff7d00': '#c89200',
  '#cc6400': '#9c7200',
  '#ff9933': '#e8ac2e',
  '#ff9966': '#e0a765',
  '#f2c94c': '#f0c060',

  // ---- dark: teal-blue -> brand navy ----
  '#045889': '#0b2350',
  '#033d61': '#061838',
  '#0670a8': '#1a3f7a',
  '#022a44': '#04122c',
  '#011520': '#020b18',

  // ---- neutrals: drop the orange tint ----
  '#fff5eb': '#f7f9fc',
  '#fff0e0': '#eef2f8',
  '#f7f4f1': '#f5f7fa',
  '#ede8e3': '#e7ecf3',
  '#fffaf5': '#fafcff',
  '#f5f0eb': '#eef2f7',
  '#fff5e6': '#f2f6fb',
  '#fff8f0': '#fbf7ec',
  '#ffe0c2': '#f5e3b8',
  '#e6f4fb': '#e8eef8',
  '#e0f0fa': '#dde7f5',

  // ---- borders ----
  '#ffd9b3': '#cfd9e6',
  '#ffd9b34f': '#cfd9e64f',

  // ---- body text ----
  '#5a6a7a': '#4b5768',
  '#8a9baa': '#8593a5',

  // ---- alpha variants (hex-with-alpha) ----
  '#ff7d0021': '#c8920021',
  '#ff7d0010': '#c8920010',
  '#04588921': '#0b235021',
  '#ff996621': '#e0a76521',
  '#f2c94c21': '#f0c06021',
  '#045889b3': '#0b2350b3',
  '#0458895e': '#0b23505e',
  '#04588930': '#0b235030',
  '#0458897d': '#0b23507d',
  '#045889bf': '#0b2350bf',
  '#ff7d00ab': '#c89200ab',
  '#ff7d0052': '#c8920052',
  '#03306150': '#06183850',

  // ---- rgb()/rgba() spellings of the same colours ----
  'rgba(255, 125, 0, 0.1)': 'rgba(200, 146, 0, 0.1)',
  'rgba(255, 125, 0, 0.15)': 'rgba(200, 146, 0, 0.15)',
  'rgb(255, 240, 224)': 'rgb(238, 242, 248)',
  'rgb(224, 240, 250)': 'rgb(221, 231, 245)',
};

/** admin.css keeps its own two-variable palette; hold them in step. */
const ADMIN_MAP = {
  '#ff7d00': '#c89200',
  '#e97200': '#a87b00',
  '#045889': '#0b2350',
  'rgba(255, 125, 0, 0.35)': 'rgba(200, 146, 0, 0.35)',
};

async function retint(relPath, map) {
  const file = ROOT + relPath;
  const before = await readFile(file, 'utf8');
  let after = before;
  const tally = {};

  // Longest keys first so '#ff7d0021' is consumed before '#ff7d00'.
  for (const key of Object.keys(map).sort((a, b) => b.length - a.length)) {
    const parts = after.split(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
    const n = parts.length - 1;
    if (n) {
      after = parts.join(map[key]);
      tally[key] = n;
    }
  }

  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  console.log(`\n${relPath}: ${total} replacement(s)`);
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`   ${String(v).padStart(4)}  ${k}  ->  ${map[k]}`);
  }
  const rest = Object.keys(tally).length - 12;
  if (rest > 0) console.log(`   … and ${rest} more mappings`);

  if (APPLY && after !== before) await writeFile(file, after, 'utf8');
  return total;
}

console.log(APPLY ? 'APPLYING' : 'DRY RUN');
let total = 0;
total += await retint('public/assets/css/styles.css', MAP);
total += await retint('app/(admin)/admin.css', ADMIN_MAP);

console.log(`\n${APPLY ? 'wrote' : 'would change'} ${total} colour value(s)`);
if (!APPLY) console.log('Re-run with --apply to write.');
