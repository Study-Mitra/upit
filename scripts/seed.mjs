/**
 * Seed MongoDB from data/extracted/*.json.
 *
 * Idempotent: every document is upserted on its natural key, so this can be
 * re-run after any extractor change without duplicating or losing data.
 *
 * Usage:
 *   node scripts/seed.mjs              # seed every extracted collection
 *   node scripts/seed.mjs courses      # seed one
 */
import { readFile, readdir } from 'node:fs/promises';
import { MongoClient } from 'mongodb';

const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const DB = process.env.MONGODB_DB ?? 'srmflexilearn';
const DIR = new URL('../data/extracted/', import.meta.url);

/** Natural key per collection, used for the upsert filter. */
const KEYS = {
  courses: 'slug',
  universities: 'slug',
  specializations: 'slug',
  specializationDetails: 'slug',
  blogs: 'slug',
  courseCategories: 'slug',
  pages: 'slug',
  homeSections: 'key',
};

async function main() {
  const only = process.argv[2];
  const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));

  const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 5000 }).connect();
  const db = client.db(DB);

  for (const file of files) {
    const name = file.replace(/\.json$/, '');
    if (only && name !== only) continue;

    const docs = JSON.parse(await readFile(new URL(file, DIR), 'utf8'));
    if (!Array.isArray(docs) || !docs.length) {
      console.log(`  ${name.padEnd(22)} (empty, skipped)`);
      continue;
    }

    const key = KEYS[name] ?? 'slug';
    const col = db.collection(name);

    let upserted = 0;
    let modified = 0;
    for (const doc of docs) {
      if (doc[key] === undefined) {
        console.error(`  ${name}: document missing key "${key}" —`, JSON.stringify(doc).slice(0, 120));
        continue;
      }
      const res = await col.updateOne(
        { [key]: doc[key] },
        { $set: { ...doc, updatedAt: new Date() } },
        { upsert: true }
      );
      if (res.upsertedCount) upserted++;
      if (res.modifiedCount) modified++;
    }

    await col.createIndex({ [key]: 1 }, { unique: true });
    const total = await col.countDocuments();
    console.log(`  ${name.padEnd(22)} ${String(docs.length).padStart(4)} docs  (+${upserted} new, ~${modified} updated)  collection total: ${total}`);
  }

  await client.close();
  console.log('\nseed complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
