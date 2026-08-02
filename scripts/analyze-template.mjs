/**
 * Phase A1 — find the variable regions of a template mechanically.
 *
 * Guessing which parts of a template are data and which are chrome is how
 * extractors silently drop fields. This walks N instances of one route family in
 * parallel and reports every DOM position where they disagree, which yields the
 * schema as a fact rather than an assumption.
 *
 * Usage:
 *   node scripts/analyze-template.mjs course
 *   node scripts/analyze-template.mjs course --limit 8 --depth 6
 */
import { readFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { extractContent } from './gen-page.mjs';

const RAW = new URL('../data/raw/', import.meta.url);
const INVENTORY = new URL('../data/inventory.json', import.meta.url);

/**
 * Build a positional signature tree for one document's content region.
 * Each node is keyed by its path (tag + class + index chain) so the same
 * structural position can be compared across instances.
 */
function nodeMap($, root, path, depth, maxDepth, out) {
  const children = root.children.filter((c) => c.type === 'tag');
  children.forEach((el, i) => {
    const cls = ($(el).attr('class') || '').split(/\s+/)[0] || '';
    const key = `${path}/${el.tagName}${cls ? '.' + cls : ''}[${i}]`;
    const $el = $(el);
    out.set(key, {
      tag: el.tagName,
      text: $el.text().replace(/\s+/g, ' ').trim(),
      html: $.html(el),
      attrs: { ...el.attribs },
      childCount: children.length,
    });
    if (depth < maxDepth) nodeMap($, el, key, depth + 1, maxDepth, out);
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const family = argv[0];
  if (!family) {
    console.error('usage: node scripts/analyze-template.mjs <family> [--limit N] [--depth N]');
    process.exit(1);
  }
  const limit = parseInt(argv[argv.indexOf('--limit') + 1] ?? '10', 10);
  const maxDepth = parseInt(argv[argv.indexOf('--depth') + 1] ?? '5', 10);

  const inv = JSON.parse(await readFile(INVENTORY, 'utf8'));
  const pages = inv.pages.filter((p) => p.family === family);
  if (!pages.length) {
    console.error(`no pages in family "${family}"`);
    process.exit(1);
  }

  // Group by section signature first — different signatures are different
  // variants and must be analysed separately or everything looks "variable".
  const groups = new Map();
  for (const p of pages) {
    const $ = load(await readFile(new URL(p.file, RAW), 'utf8'));
    let sig;
    try {
      const { html } = extractContent($);
      const $c = load(html, null, false);
      sig = $c.root()[0].children
        .filter((c) => c.type === 'tag')
        .map((e) => `${e.tagName}.${(($c(e).attr('class') || '').split(' ')[0])}`)
        .join(' > ');
    } catch (err) {
      sig = `ERROR: ${err.message}`;
    }
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig).push(p);
  }

  console.log(`family "${family}": ${pages.length} pages, ${groups.size} signature group(s)\n`);

  for (const [sig, members] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log('='.repeat(100));
    console.log(`GROUP (${members.length} pages): ${sig}`);
    console.log(`  e.g. ${members.slice(0, 4).map((m) => m.path).join(', ')}`);

    const sample = members.slice(0, limit);
    const maps = [];
    for (const p of sample) {
      const $ = load(await readFile(new URL(p.file, RAW), 'utf8'));
      const { html } = extractContent($);
      const $c = load(html, null, false);
      const m = new Map();
      nodeMap($c, $c.root()[0], '', 0, maxDepth, m);
      maps.push({ path: p.path, m });
    }

    // A key is CONSTANT if every sampled instance has it with identical html,
    // VARIABLE if present everywhere but differing, OPTIONAL if missing somewhere.
    const allKeys = new Set(maps.flatMap((x) => [...x.m.keys()]));
    const constant = [];
    const variable = [];
    const optional = [];

    for (const key of allKeys) {
      const present = maps.filter((x) => x.m.has(key));
      if (present.length !== maps.length) {
        optional.push({ key, presentIn: present.length, of: maps.length });
        continue;
      }
      const htmls = new Set(present.map((x) => x.m.get(key).html));
      const texts = new Set(present.map((x) => x.m.get(key).text));
      if (htmls.size === 1) constant.push(key);
      else variable.push({ key, distinctHtml: htmls.size, distinctText: texts.size, sample: present[0].m.get(key) });
    }

    // Report only the SHALLOWEST variable nodes — a deep variable node implies
    // its ancestors vary too, and listing all of them is noise.
    const isDescendantOfVariable = (k) =>
      variable.some((v) => v.key !== k && k.startsWith(v.key + '/'));
    const topVariable = variable.filter((v) => !isDescendantOfVariable(v.key));
    const topOptional = optional.filter(
      (o) => !optional.some((x) => x.key !== o.key && o.key.startsWith(x.key + '/'))
    );

    console.log(`\n  constant nodes: ${constant.length}   variable: ${variable.length} (${topVariable.length} top-level)   optional: ${optional.length} (${topOptional.length} top-level)`);

    console.log('\n  --- VARIABLE (these become schema fields) ---');
    for (const v of topVariable.slice(0, 40)) {
      const t = v.sample.text.slice(0, 70).replace(/\s+/g, ' ');
      console.log(`    ${v.key}`);
      console.log(`        distinct html=${v.distinctHtml}/${maps.length} text=${v.distinctText}  e.g. "${t}"`);
    }
    if (topVariable.length > 40) console.log(`    ... +${topVariable.length - 40} more`);

    if (topOptional.length) {
      console.log('\n  --- OPTIONAL (conditional blocks) ---');
      for (const o of topOptional.slice(0, 25)) {
        console.log(`    ${o.key}   present in ${o.presentIn}/${o.of}`);
      }
      if (topOptional.length > 25) console.log(`    ... +${topOptional.length - 25} more`);
    }
    console.log();
  }
}

main();
