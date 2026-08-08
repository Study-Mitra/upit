/**
 * Copy every collection from one MongoDB to another — local -> Atlas for the
 * first deploy.
 *
 *   node scripts/migrate-to-atlas.mjs                      # dry run
 *   node scripts/migrate-to-atlas.mjs --apply
 *   node scripts/migrate-to-atlas.mjs --apply --drop       # replace target docs
 *
 * SOURCE is MONGODB_URI/MONGODB_DB from .env — whatever the site currently
 * reads. TARGET must be passed explicitly, so this can never guess where it is
 * writing:
 *
 *   TARGET_URI='mongodb+srv://…' TARGET_DB=upitcollege \
 *     node scripts/migrate-to-atlas.mjs --apply
 *
 * WHY NOT mongodump/mongorestore
 * They are not installed with the driver and would need the Database Tools
 * package. This moves the same data with what the repo already depends on, and
 * prints a per-collection count so the copy is verifiable rather than assumed.
 *
 * IDEMPOTENCE
 * Documents are upserted by _id, so re-running converges instead of duplicating.
 * --drop empties each target collection first, which is what you want if the
 * source is authoritative and the target has diverged.
 */
import { MongoClient } from 'mongodb';
import { MONGODB_URI as SRC_URI, MONGODB_DB as SRC_DB, requireEnv } from '../lib/env.mjs';

const APPLY = process.argv.includes('--apply');
const DROP = process.argv.includes('--drop');

const TARGET_URI = requireEnv('TARGET_URI');
const TARGET_DB = process.env.TARGET_DB || SRC_DB;

/** Never copy these: they are rebuilt per environment, not migrated. */
const SKIP = new Set(['system.indexes', 'system.profile']);

function redact(uri) {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
}

console.log(APPLY ? 'APPLYING' : 'DRY RUN — nothing will be written');
console.log(`  source: ${redact(SRC_URI)}  db=${SRC_DB}`);
console.log(`  target: ${redact(TARGET_URI)}  db=${TARGET_DB}`);
if (DROP) console.log('  --drop: target collections will be emptied first');

if (redact(SRC_URI) === redact(TARGET_URI) && SRC_DB === TARGET_DB) {
  console.error('\nSource and target are the same database. Refusing to run.');
  process.exit(1);
}

const src = new MongoClient(SRC_URI, { serverSelectionTimeoutMS: 10000 });
const dst = new MongoClient(TARGET_URI, { serverSelectionTimeoutMS: 15000 });

try {
  await src.connect();
} catch (e) {
  console.error(`\nCannot reach the SOURCE database: ${e.message.split('\n')[0]}`);
  process.exit(1);
}
try {
  await dst.connect();
} catch (e) {
  console.error(`\nCannot reach the TARGET database: ${e.message.split('\n')[0]}`);
  console.error(
    'If this is Atlas and the error is a selection timeout, the usual cause is\n' +
      'that this machine is not in Network Access. A wrong password fails fast\n' +
      'with "bad auth" instead.'
  );
  await src.close();
  process.exit(1);
}

const sdb = src.db(SRC_DB);
const ddb = dst.db(TARGET_DB);

const collections = (await sdb.listCollections().toArray())
  .map((c) => c.name)
  .filter((n) => !SKIP.has(n))
  .sort();

console.log(`\n${collections.length} collection(s) to copy\n`);

let totalRead = 0;
let totalWritten = 0;

for (const name of collections) {
  const docs = await sdb.collection(name).find({}).toArray();
  const before = await ddb.collection(name).countDocuments().catch(() => 0);
  totalRead += docs.length;

  let written = 0;
  if (APPLY && docs.length) {
    if (DROP) await ddb.collection(name).deleteMany({});
    // Batched so one oversized bulk payload cannot fail the whole collection.
    for (let i = 0; i < docs.length; i += 500) {
      const batch = docs.slice(i, i + 500);
      const res = await ddb.collection(name).bulkWrite(
        batch.map((doc) => ({
          replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
        })),
        { ordered: false }
      );
      written += res.upsertedCount + res.modifiedCount + res.matchedCount;
    }
    totalWritten += written;
  }

  const after = APPLY ? await ddb.collection(name).countDocuments() : before;
  console.log(
    `  ${name.padEnd(20)} source=${String(docs.length).padStart(5)}` +
      `  target=${String(before).padStart(5)} -> ${String(after).padStart(5)}` +
      (APPLY ? `  (${written} written)` : '')
  );
}

// Indexes are not implicit: a fresh Atlas database has none of the source's.
console.log('\nIndexes:');
for (const name of collections) {
  const idx = (await sdb.collection(name).indexes()).filter((i) => i.name !== '_id_');
  if (!idx.length) continue;
  for (const i of idx) {
    if (APPLY) {
      await ddb
        .collection(name)
        .createIndex(i.key, { name: i.name, unique: !!i.unique, sparse: !!i.sparse });
    }
    console.log(`  ${name}.${i.name} ${JSON.stringify(i.key)}${i.unique ? ' UNIQUE' : ''}`);
  }
}

console.log(
  `\n${APPLY ? 'copied' : 'would copy'} ${totalRead} document(s) across ${collections.length} collection(s)`
);
if (APPLY) console.log(`wrote ${totalWritten}`);
else console.log('Re-run with --apply to write.');

await src.close();
await dst.close();
