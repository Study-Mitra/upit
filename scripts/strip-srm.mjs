/**
 * Remove every visitor-findable trace of the previous brand.
 *
 *   node scripts/strip-srm.mjs            # dry run
 *   node scripts/strip-srm.mjs --apply
 *
 * The rebrand replaced brand TEXT. This handles what a visitor can still dig out
 * of the page source:
 *
 *  1. CSS class names. 35 distinct `srm-*` classes appear in the served markup —
 *     144 on the university listing alone — and in styles.css. They are renamed
 *     to `upit-*`. The rename must hit the stylesheet, the components AND the
 *     stored HTML in Mongo in one pass, or the styling silently breaks.
 *
 *  2. styles.original.css. Served at /assets/css/styles.original.css with HTTP
 *     200, carrying the old brand and the entire previous orange theme. It is a
 *     reference copy, so it is moved out of public/ rather than edited.
 *
 *  3. The old domain in the schema.org block and the old Instagram profile.
 *
 * NOT changed: the Mongo database name (server-side only, and renaming it points
 * the app at an empty database), scripts/ and data/raw/ (never served).
 */
import { readFile, writeFile, rename, access } from 'node:fs/promises';
import { MongoClient } from 'mongodb';

const ROOT = new URL('..', import.meta.url).pathname;
const APPLY = process.argv.includes('--apply');
const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const DB = process.env.MONGODB_DB ?? 'srmflexilearn';

const CSS_FILES = ['public/assets/css/styles.css', 'public/assets/css/compare-page.css'];
const SRC_GLOBS = ['components', 'app'];

/** `srm-` prefixed class names -> `upit-`. Covers all 35 tokens at once. */
const CLASS_RE = /\bsrm-/g;
const CLASS_TO = 'upit-';

let changes = 0;

async function retoken(relPath) {
  const file = ROOT + relPath;
  try {
    await access(file);
  } catch {
    return;
  }
  const before = await readFile(file, 'utf8');
  const n = (before.match(CLASS_RE) ?? []).length;
  if (!n) return;
  changes += n;
  console.log(`  ${String(n).padStart(4)}  ${relPath}`);
  if (APPLY) await writeFile(file, before.replace(CLASS_RE, CLASS_TO), 'utf8');
}

async function* walk(dir) {
  const { readdir, stat } = await import('node:fs/promises');
  for (const entry of await readdir(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const full = `${dir}/${entry}`;
    const s = await stat(full);
    if (s.isDirectory()) yield* walk(full);
    else if (/\.(tsx?|css)$/.test(entry)) yield full;
  }
}

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'}\n`);

console.log('--- stylesheets ---');
for (const f of CSS_FILES) await retoken(f);

console.log('\n--- components / app ---');
for (const dir of SRC_GLOBS) {
  for await (const f of walk(ROOT + dir)) await retoken(f.replace(ROOT, ''));
}

console.log('\n--- database ---');
const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 5000 }).connect();
const db = client.db(DB);
for (const name of ['pages', 'courses', 'universities']) {
  const col = db.collection(name);
  let docs = 0;
  let hits = 0;
  for (const doc of await col.find({}).toArray()) {
    const patch = {};
    for (const [field, value] of Object.entries(doc)) {
      if (field === '_id') continue;
      // contentHtmlOriginal is included on purpose: it is the listing rollback,
      // and restoring markup whose classes no longer exist in the stylesheet
      // would render unstyled, making the rollback useless.
      if (typeof value === 'string') {
        const n = (value.match(CLASS_RE) ?? []).length;
        if (n) {
          hits += n;
          patch[field] = value.replace(CLASS_RE, CLASS_TO);
        }
      } else if (value && typeof value === 'object') {
        const s = JSON.stringify(value);
        const n = (s.match(CLASS_RE) ?? []).length;
        if (n) {
          hits += n;
          patch[field] = JSON.parse(s.replace(CLASS_RE, CLASS_TO));
        }
      }
    }
    if (!Object.keys(patch).length) continue;
    docs++;
    if (APPLY) await col.updateOne({ _id: doc._id }, { $set: patch });
  }
  changes += hits;
  console.log(`  ${String(hits).padStart(4)} in ${docs} doc(s) of ${name}`);
}
await client.close();

console.log('\n--- reference stylesheet exposure ---');
const ORIG = 'public/assets/css/styles.original.css';
try {
  await access(ROOT + ORIG);
  console.log(`  ${ORIG} is web-reachable and carries the previous brand + theme`);
  console.log('  -> moving to backups/styles.original.css (outside public/)');
  if (APPLY) await rename(ROOT + ORIG, `${ROOT}backups/styles.original.css`);
} catch {
  console.log('  already moved ✓');
}

console.log(`\n${APPLY ? 'wrote' : 'would change'} ${changes} class-name occurrence(s)`);
if (!APPLY) console.log('Re-run with --apply to write.');
