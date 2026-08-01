/**
 * Recover the course-category lookup that `universities.courseIds` points at.
 *
 *   node scripts/seed-course-categories.mjs            # dry run
 *   node scripts/seed-course-categories.mjs --apply
 *
 * THE GAP THIS FILLS
 * `universities.courseIds` holds numeric strings ("13", "19", …) inherited from
 * the original Laravel app. Those ids are foreign keys to a course-category table
 * that was never ported: the `courses` collection is keyed by slug and has no
 * numeric id. `/get-universities` and `/filter-course` still match on them, so
 * the ids are load-bearing — but nothing in the database maps an id to a name,
 * which makes them unpresentable in an admin form.
 *
 * The mapping does survive in one place: the `#course_id` <select> baked into the
 * /compare-university page markup. This extracts it into its own collection so
 * the admin can show real names instead of bare numbers.
 */
import { MongoClient } from 'mongodb';
import * as cheerio from 'cheerio';

const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const DB = process.env.MONGODB_DB ?? 'srmflexilearn';
const APPLY = process.argv.includes('--apply');

const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 5000 }).connect();
const db = client.db(DB);

const page = await db
  .collection('pages')
  .findOne({ path: '/compare-university' }, { projection: { _id: 0, contentHtml: 1 } });

if (!page) {
  console.error('FATAL: /compare-university page not found — cannot recover the mapping.');
  await client.close();
  process.exit(1);
}

const $ = cheerio.load(page.contentHtml);
const options = [];
$('#course_id option').each((_, el) => {
  const id = ($(el).attr('value') ?? '').trim();
  const name = $(el).text().replace(/\s+/g, ' ').trim();
  if (id && name) options.push({ id, name });
});

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — found ${options.length} course categories`);
options.slice(0, 8).forEach((o) => console.log(`  ${o.id.padStart(3)}  ${o.name}`));
if (options.length > 8) console.log(`  … and ${options.length - 8} more`);

// Which ids are actually referenced by a college?
const unis = await db
  .collection('universities')
  .find({}, { projection: { _id: 0, courseIds: 1 } })
  .toArray();
const referenced = new Set(unis.flatMap((u) => u.courseIds ?? []));
const known = new Set(options.map((o) => o.id));
const orphans = [...referenced].filter((id) => !known.has(id));

console.log(`\nreferenced by colleges: ${referenced.size} distinct ids`);
console.log(
  orphans.length
    ? `orphan ids with no name: ${orphans.join(', ')}`
    : 'every referenced id has a name ✓'
);

if (!options.length) {
  console.error('\nFATAL: no options extracted — refusing to write an empty lookup.');
  await client.close();
  process.exit(1);
}

if (APPLY) {
  const col = db.collection('courseCategories');
  await col.createIndex({ id: 1 }, { unique: true });
  for (const o of options) {
    await col.updateOne({ id: o.id }, { $set: o }, { upsert: true });
  }
  console.log(`\nwrote ${options.length} course categories`);
} else {
  console.log('\nRe-run with --apply to write.');
}

await client.close();
