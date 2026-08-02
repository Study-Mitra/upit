/**
 * Rebrand the site: replace company data across source files and database content.
 *
 *   node scripts/rebrand.mjs            # dry run — reports, writes nothing
 *   node scripts/rebrand.mjs --apply    # write
 *
 * Values come from scripts/rebrand.config.json. Any entry whose `to` is null is
 * SKIPPED and reported: a wrong phone number or address on every page is worse
 * than one that has not been updated yet.
 *
 * WHAT IS DELIBERATELY NOT TOUCHED
 *  - lib/mongodb.ts — `dbName = 'srmflexilearn'` is the actual Mongo database
 *    name. Renaming it points the app at an empty database.
 *  - scripts/ — DB constants and crawl URLs referencing the ORIGINAL site, which
 *    is the import source, not our branding.
 *  - data/raw/*.html — the fidelity baseline for scripts/html-diff.mjs.
 *  - pages.contentHtmlOriginal — the pre-migration rollback copy. It must keep
 *    matching what was imported or it is useless as a rollback.
 *  - node_modules, .next, public/assets (vendor code).
 */
import { readFile, writeFile, readdir, stat, copyFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { MongoClient } from 'mongodb';

const ROOT = new URL('..', import.meta.url).pathname;
const APPLY = process.argv.includes('--apply');
const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const DB = process.env.MONGODB_DB ?? 'srmflexilearn';

const config = JSON.parse(await readFile(join(ROOT, 'scripts/rebrand.config.json'), 'utf8'));

/** Directories scanned for source replacements. */
const SOURCE_DIRS = ['components', 'app', 'lib'];
const SOURCE_EXTS = new Set(['.ts', '.tsx']);

/** Never rewritten, whatever the config says. */
const EXCLUDED_FILES = new Set([join(ROOT, 'lib/mongodb.ts')]);

/** DB fields that must keep their imported values. */
const EXCLUDED_DB_FIELDS = new Set(['contentHtmlOriginal']);

/** Build the ordered replacement list from config; skip null targets. */
function buildRules() {
  const rules = [];
  const skipped = [];
  const add = (name, from, to) => {
    if (!from) return;
    if (to == null || to === '') skipped.push(name);
    else rules.push({ name, from, to });
  };

  add('email', config.email?.from, config.email?.to);
  add('domain', config.domain?.from, config.domain?.to);
  add('address', config.address?.from, config.address?.to);
  add('facebook', config.social?.facebook?.from, config.social?.facebook?.to);
  add('instagram', config.social?.instagram?.from, config.social?.instagram?.to);
  add('logo', config.logo?.from, config.logo?.to);
  add('phone', config.phone?.from, config.phone?.to);
  add('brandName', config.brandName?.from, config.brandName?.to);
  add('domainSlug', config.domainSlug?.from, config.domainSlug?.to);

  // The URL-encoded address inside the Footer's Google Maps link. Without this
  // the map keeps pointing at the old office.
  if (config.address?.from && config.address?.to) {
    rules.push({
      name: 'address (url-encoded)',
      from: encodeURIComponent(config.address.from).replace(/%20/g, '+'),
      to: encodeURIComponent(config.address.to).replace(/%20/g, '+'),
    });
    rules.push({
      name: 'maps label (url-encoded)',
      from: encodeURIComponent(config.brandName.from).replace(/%20/g, '+'),
      to: encodeURIComponent(config.brandName.to).replace(/%20/g, '+'),
    });
  }

  /**
   * Lowercase brand mentions, e.g. the SEO keyword list "srm education, online
   * education, …". Handled before the bare-word rule so it produces the full new
   * name rather than "upit education".
   */
  if (config.brandName?.from && config.brandName?.to) {
    rules.push({
      name: 'brandName (lowercase)',
      regex: new RegExp(`\\b${config.brandName.from.toLowerCase()}\\b`, 'g'),
      to: config.brandName.to.toLowerCase(),
    });
  }

  /**
   * Bare "SRM" runs LAST and only after the longer phrases above, so
   * "SRM Education" is already gone and this catches only standalone uses.
   *
   * The negative lookahead for a hyphen is essential: `srm-approval-badge`,
   * `srm-left-panel` and `srm-uni-box` are CSS class names defined in
   * styles.css and echoed in every stored cardHtml. Renaming those silently
   * unstyles the listing cards and the lead modal.
   *
   * Case-insensitive, because the keyword lists use lowercase.
   */
  if (config.brandShort?.from && config.brandShort?.to) {
    rules.push({
      name: 'brandShort (not a CSS class)',
      regex: new RegExp(`\\b${config.brandShort.from}\\b(?!-)`, 'gi'),
      to: config.brandShort.to,
    });
  } else {
    skipped.push('brandShort');
  }

  return { rules, skipped };
}

function applyRules(text, rules, tally) {
  let out = text;
  for (const r of rules) {
    let count = 0;
    if (r.regex) {
      out = out.replace(r.regex, () => {
        count++;
        return r.to;
      });
    } else {
      const parts = out.split(r.from);
      count = parts.length - 1;
      if (count) out = parts.join(r.to);
    }
    if (count) tally[r.name] = (tally[r.name] ?? 0) + count;
  }
  return out;
}

async function* walk(dir) {
  for (const entry of await readdir(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const s = await stat(full);
    if (s.isDirectory()) yield* walk(full);
    else if (SOURCE_EXTS.has(extname(entry))) yield full;
  }
}

const { rules, skipped } = buildRules();

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — ${rules.length} active rule(s)\n`);
for (const r of rules) {
  console.log(`  ${r.name.padEnd(24)} ${String(r.from ?? r.regex).slice(0, 46)}  ->  ${r.to}`);
}
if (skipped.length) {
  console.log(`\n  SKIPPED (no value set in rebrand.config.json): ${skipped.join(', ')}`);
}

// ------------------------------------------------------------ source files
console.log('\n--- source files ---');
const fileTally = {};
let filesChanged = 0;

for (const dir of SOURCE_DIRS) {
  for await (const file of walk(join(ROOT, dir))) {
    if (EXCLUDED_FILES.has(file)) continue;
    const before = await readFile(file, 'utf8');
    const tally = {};
    const after = applyRules(before, rules, tally);
    if (after === before) continue;
    filesChanged++;
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    console.log(
      `  ${String(total).padStart(4)}  ${file.replace(ROOT, '')}  [${Object.keys(tally).join(', ')}]`
    );
    for (const [k, v] of Object.entries(tally)) fileTally[k] = (fileTally[k] ?? 0) + v;
    if (APPLY) await writeFile(file, after, 'utf8');
  }
}
console.log(`  ${filesChanged} file(s) ${APPLY ? 'written' : 'would change'}`);

// --------------------------------------------------------------- database
console.log('\n--- database ---');
const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 5000 }).connect();
const db = client.db(DB);
const dbTally = {};
let docsChanged = 0;

for (const name of ['pages', 'courses', 'universities']) {
  const col = db.collection(name);
  const docs = await col.find({}).toArray();
  let changedHere = 0;

  for (const doc of docs) {
    const patch = {};
    const tally = {};
    for (const [field, value] of Object.entries(doc)) {
      if (field === '_id' || EXCLUDED_DB_FIELDS.has(field)) continue;
      if (typeof value === 'string') {
        const next = applyRules(value, rules, tally);
        if (next !== value) patch[field] = next;
      } else if (value && typeof value === 'object') {
        const before = JSON.stringify(value);
        const after = applyRules(before, rules, tally);
        if (after !== before) {
          try {
            patch[field] = JSON.parse(after);
          } catch {
            // A replacement broke the JSON — skip rather than corrupt the doc.
            console.log(`      ! skipped ${name}.${field} (${doc.slug ?? doc.path}): invalid JSON after replace`);
          }
        }
      }
    }
    if (!Object.keys(patch).length) continue;
    changedHere++;
    docsChanged++;
    for (const [k, v] of Object.entries(tally)) dbTally[k] = (dbTally[k] ?? 0) + v;
    if (APPLY) await col.updateOne({ _id: doc._id }, { $set: patch });
  }
  console.log(`  ${String(changedHere).padStart(4)} / ${docs.length} docs in ${name}`);
}

// ----------------------------------------------------------------- summary
console.log('\n--- totals ---');
const all = {};
for (const [k, v] of Object.entries(fileTally)) all[k] = (all[k] ?? 0) + v;
for (const [k, v] of Object.entries(dbTally)) all[k] = (all[k] ?? 0) + v;
for (const [k, v] of Object.entries(all).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(5)}  ${k}`);
}
console.log(
  `\n${APPLY ? `WROTE ${filesChanged} files and ${docsChanged} documents` : `would change ${filesChanged} files and ${docsChanged} documents`}`
);
if (!APPLY) console.log('Re-run with --apply to write.');
if (skipped.length) {
  console.log(`\nStill unset: ${skipped.join(', ')} — fill these into scripts/rebrand.config.json.`);
}

await client.close();
