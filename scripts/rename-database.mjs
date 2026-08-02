/**
 * Migrate the Mongo database from the old brand name to the new one.
 *
 *   node scripts/rename-database.mjs            # dry run
 *   node scripts/rename-database.mjs --apply    # copy + verify
 *   node scripts/rename-database.mjs --drop-old # only after the app is verified
 *
 * MongoDB has no rename-database command, so every collection is copied into the
 * new database and the old one is dropped separately. The drop is a distinct flag
 * on purpose: the copy must be verified, the application pointed at the new name,
 * and the site checked BEFORE anything is destroyed.
 *
 * Indexes are recreated, not just documents — adminUsers has a unique index on
 * email and courseCategories one on id. Copying documents alone would silently
 * lose both.
 */
import { MongoClient } from 'mongodb';

const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
// Literal names, kept out of any global find/replace: a sweep that rewrote OLD
// to the new value would make --drop-old destroy the database it just created.
const OLD = ['srm','flexilearn'].join('');
const NEW = 'upitcollege';
const APPLY = process.argv.includes('--apply');
const DROP = process.argv.includes('--drop-old');

const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 5000 }).connect();
const oldDb = client.db(OLD);
const newDb = client.db(NEW);

const names = (await oldDb.listCollections().toArray()).map((c) => c.name).sort();

if (DROP) {
  // Refuse to drop unless the copy is provably complete.
  let ok = true;
  console.log('verifying the copy before dropping the old database\n');
  for (const name of names) {
    const a = await oldDb.collection(name).countDocuments();
    const b = await newDb.collection(name).countDocuments();
    const match = a === b;
    if (!match) ok = false;
    console.log(`  ${match ? 'OK ' : 'BAD'} ${name.padEnd(18)} ${a} -> ${b}`);
  }
  if (!ok) {
    console.error('\nREFUSING TO DROP: counts do not match. Re-run --apply first.');
    await client.close();
    process.exit(1);
  }
  await oldDb.dropDatabase();
  console.log(`\ndropped "${OLD}"`);
  console.log('remaining databases:',
    (await client.db().admin().listDatabases()).databases.map((d) => d.name).join(', '));
  await client.close();
  process.exit(0);
}

console.log(`${APPLY ? 'COPYING' : 'DRY RUN'}  ${OLD} -> ${NEW}\n`);

for (const name of names) {
  const docs = await oldDb.collection(name).find({}).toArray();
  const idx = await oldDb.collection(name).indexes();
  const custom = idx.filter((i) => i.name !== '_id_');

  console.log(
    `  ${name.padEnd(18)} ${String(docs.length).padStart(4)} docs, ` +
      `${custom.length} custom index(es)${custom.length ? ' [' + custom.map((i) => i.name).join(', ') + ']' : ''}`
  );

  if (!APPLY) continue;

  const target = newDb.collection(name);
  // Idempotent: a re-run replaces rather than duplicating.
  await target.deleteMany({});
  if (docs.length) await target.insertMany(docs);
  for (const i of custom) {
    await target.createIndex(i.key, {
      name: i.name,
      unique: Boolean(i.unique),
      sparse: Boolean(i.sparse),
    });
  }
}

if (APPLY) {
  console.log('\nverifying:');
  let ok = true;
  for (const name of names) {
    const a = await oldDb.collection(name).countDocuments();
    const b = await newDb.collection(name).countDocuments();
    if (a !== b) ok = false;
    console.log(`  ${a === b ? 'OK ' : 'BAD'} ${name.padEnd(18)} ${a} -> ${b}`);
  }
  console.log(ok ? '\ncopy complete and verified' : '\nMISMATCH — do not drop the old database');
  console.log('Next: update lib/mongodb.ts, check the site, then run --drop-old');
} else {
  console.log('\nRe-run with --apply to copy.');
}

await client.close();
