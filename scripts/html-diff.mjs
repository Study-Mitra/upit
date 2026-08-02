/**
 * Compare the rendered content region of a local page against its crawled
 * snapshot, node by node.
 *
 * A screenshot diff tells you a page is wrong; this tells you exactly which
 * node. It is far cheaper than iterating on pixels, and it catches the failure
 * mode that hand-written templates keep hitting: whitespace between inline
 * elements, which HTML renders as a space but JSX silently drops.
 *
 * Usage:
 *   node scripts/html-diff.mjs /course/mba-regular
 *   node scripts/html-diff.mjs /course/mba-regular --all   # include text-only diffs
 */
import { readFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { extractContent } from './gen-page.mjs';
import { safeName } from './lib/common.mjs';

const RAW = new URL('../data/raw/', import.meta.url);
const LOCAL = process.env.LOCAL_ORIGIN ?? 'http://localhost:3100';

/**
 * Elements whose default display is inline or inline-block. Whitespace BETWEEN
 * these renders as a visible space; whitespace between block elements does not.
 * Only the former can shift layout, so only the former is reported as an error.
 * `li` is included because this theme's .page-list and .quick-access lay their
 * items out inline.
 */
const INLINE_ISH = new Set([
  'a', 'span', 'i', 'em', 'strong', 'b', 'small', 'label', 'img', 'button',
  'input', 'select', 'textarea', 'li', 'sup', 'sub', 'code', 'abbr', 'u', 's',
]);

/**
 * Flatten a DOM tree into comparable records.
 *
 * Whitespace-only text nodes are NOT emitted as records — a single missing one
 * would desynchronise index alignment and bury the real differences. Instead
 * each element carries `spaceBefore`, so whitespace is compared positionally
 * without breaking alignment.
 */
function flatten($, root, path, out) {
  const children = root.children ?? [];
  let elemIndex = 0;
  let pendingSpace = false;

  for (const node of children) {
    if (node.type === 'text') {
      const raw = node.data ?? '';
      if (!raw.trim()) {
        pendingSpace = true;
        continue;
      }
      // Coalesce with the previous text node if nothing renderable intervened.
      // React SSR splits adjacent text expressions with <!-- --> separators, so
      // one live text node can arrive as three; comparing them separately would
      // report differences that do not exist in the rendered output.
      const prev = out[out.length - 1];
      if (prev && prev.kind === 'text' && prev.path === `${path}#text` && prev.adjacent) {
        prev.value = (prev.value + (pendingSpace ? ' ' : '') + raw).replace(/\s+/g, ' ');
        pendingSpace = false;
        continue;
      }
      out.push({
        path: `${path}#text`,
        kind: 'text',
        value: raw.replace(/\s+/g, ' '),
        spaceBefore: pendingSpace,
        adjacent: true,
      });
      pendingSpace = false;
      continue;
    }
    if (node.type === 'comment') {
      // Comments never render. Crucially, do NOT clear pendingSpace: React's
      // <!-- --> separators sit between a space and its text.
      continue;
    }
    if (node.type !== 'tag' && node.type !== 'script' && node.type !== 'style') continue;

    const cls = ($(node).attr('class') ?? '').trim();
    const key = `${path}/${node.name}${cls ? '.' + cls.split(/\s+/).join('.') : ''}[${elemIndex++}]`;
    out.push({
      path: key,
      kind: 'tag',
      tag: node.name,
      attrs: { ...node.attribs },
      spaceBefore: pendingSpace,
      inline: INLINE_ISH.has(node.name),
    });
    pendingSpace = false;
    flatten($, node, key, out);
  }
}

function attrsDiff(a, b) {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  const diffs = [];
  for (const k of keys) {
    // React normalises boolean/empty attrs; ignore pure presence-vs-empty noise.
    const av = a?.[k];
    const bv = b?.[k];
    if (av === bv) continue;
    // style strings differ only by spacing after ':' / ';' — normalise.
    if (k === 'style') {
      const n = (s) => (s ?? '').replace(/\s*([:;])\s*/g, '$1').replace(/;$/, '').trim();
      if (n(av) === n(bv)) continue;
    }
    if (k === 'class') {
      const n = (s) => (s ?? '').trim().split(/\s+/).filter(Boolean).sort().join(' ');
      if (n(av) === n(bv)) continue;
    }
    diffs.push({ attr: k, live: av, local: bv });
  }
  return diffs;
}

async function main() {
  const path = process.argv[2];
  const showAll = process.argv.includes('--all');
  if (!path) {
    console.error('usage: node scripts/html-diff.mjs <path> [--all]');
    process.exit(1);
  }

  const file = `${safeName(path)}.html`;
  const $live = load(await readFile(new URL(file, RAW), 'utf8'));
  const liveHtml = extractContent($live).html;

  const res = await fetch(LOCAL + path);
  if (!res.ok) {
    console.error(`local returned ${res.status} for ${path}`);
    process.exit(1);
  }
  const $localFull = load(await res.text());
  const localHtml = extractContent($localFull).html;

  const A = [];
  const B = [];
  flatten(load(liveHtml, null, false), load(liveHtml, null, false).root()[0], '', A);
  flatten(load(localHtml, null, false), load(localHtml, null, false).root()[0], '', B);

  console.log(`live nodes: ${A.length}   local nodes: ${B.length}\n`);

  // Align by index; a structural insertion/deletion shows up as a run of
  // mismatches starting at one point, which is the useful signal anyway.
  const max = Math.max(A.length, B.length);
  let shown = 0;
  const summary = { missingSpace: 0, extraSpace: 0, text: 0, tag: 0, attr: 0, missing: 0, blockSpace: 0 };

  for (let i = 0; i < max; i++) {
    const a = A[i];
    const b = B[i];

    if (!a || !b) {
      summary.missing++;
      if (shown++ < 40) {
        console.log(`[${i}] ONLY IN ${a ? 'LIVE' : 'LOCAL'}: ${JSON.stringify(a ?? b).slice(0, 160)}`);
      }
      continue;
    }

    if (a.kind !== b.kind || a.path !== b.path) {
      summary.tag++;
      if (shown++ < 40) {
        console.log(`[${i}] STRUCTURE`);
        console.log(`      live : ${a.path} (${a.kind})`);
        console.log(`      local: ${b.path} (${b.kind})`);
      }
      continue;
    }

    // Whitespace between inline elements renders as a space; between block
    // elements it does not. Only the former can move pixels.
    if (a.spaceBefore !== b.spaceBefore) {
      // Leading whitespace inside a container is stripped by the browser, so a
      // first child's spaceBefore can never render.
      const isFirstChild = /\[0\]$/.test(a.path) || a.path.endsWith('#text');
      const matters = (a.inline || a.kind === 'text') && !isFirstChild;
      if (matters) {
        if (a.spaceBefore) summary.missingSpace++;
        else summary.extraSpace++;
        if (shown++ < 40) {
          console.log(
            `[${i}] ${a.spaceBefore ? 'MISSING' : 'EXTRA'} WHITESPACE before ${a.path}  <-- inline, affects layout`
          );
        }
      } else {
        summary.blockSpace++;
      }
    }

    if (a.kind === 'text') {
      if (a.value !== b.value) {
        // Leading/trailing space differences matter; pure inner collapsing does not.
        if (a.value.trim() === b.value.trim() && !showAll) {
          const aEdge = /^\s|\s$/.test(a.value);
          const bEdge = /^\s|\s$/.test(b.value);
          if (aEdge === bEdge) continue;
        }
        summary.text++;
        if (shown++ < 40) {
          console.log(`[${i}] TEXT at ${a.path}`);
          console.log(`      live : ${JSON.stringify(a.value).slice(0, 120)}`);
          console.log(`      local: ${JSON.stringify(b.value).slice(0, 120)}`);
        }
      }
      continue;
    }

    const ad = attrsDiff(a.attrs, b.attrs);
    if (ad.length) {
      summary.attr++;
      if (shown++ < 40) {
        console.log(`[${i}] ATTRS at ${a.path}`);
        for (const d of ad) {
          console.log(`      ${d.attr}: live=${JSON.stringify(d.live)?.slice(0, 90)} local=${JSON.stringify(d.local)?.slice(0, 90)}`);
        }
      }
    }
  }

  if (shown > 40) console.log(`\n... +${shown - 40} more differences suppressed`);
  console.log('\nsummary:', summary);
  const { blockSpace, ...significant } = summary;
  const total = Object.values(significant).reduce((a, b) => a + b, 0);
  console.log(total === 0
    ? `\nIDENTICAL (${blockSpace} block-level whitespace differences ignored — they do not render)`
    : `\n${total} significant differing nodes`);
  process.exitCode = total === 0 ? 0 : 1;
}

main();
