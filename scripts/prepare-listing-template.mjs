/**
 * Turn the /university listing blob into a template with a card slot.
 *
 *   node scripts/prepare-listing-template.mjs            # dry run
 *   node scripts/prepare-listing-template.mjs --apply
 *
 * The listing is a 106KB page in which only `#university-list` is data: the other
 * 51KB is the filter sidebar (course tree, price bands, study modes) whose markup
 * the page's own scripts bind to. Rewriting that by hand would be a large,
 * pointless risk.
 *
 * So the sidebar is kept verbatim and the 19 hardcoded cards are replaced with a
 * single `@@CARDS@@` marker. The route renders the collection into that slot,
 * which is what makes an added college appear on the listing.
 *
 * Idempotent: if the marker is already present the page is left alone.
 */
import { MongoClient } from 'mongodb';
import * as cheerio from 'cheerio';

const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const DB = process.env.MONGODB_DB ?? 'upitcollege';
const APPLY = process.argv.includes('--apply');
export const MARKER = '@@CARDS@@';

const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 5000 }).connect();
const pages = client.db(DB).collection('pages');

const page = await pages.findOne({ path: '/university' }, { projection: { _id: 0 } });
if (!page) {
  console.error('FATAL: /university page not found.');
  await client.close();
  process.exit(1);
}

if (page.contentHtml.includes(MARKER)) {
  console.log('Already templated — marker present, nothing to do.');
  await client.close();
  process.exit(0);
}

const $ = cheerio.load(page.contentHtml);
const list = $('#university-list');
if (!list.length) {
  console.error('FATAL: #university-list not found — refusing to guess at the structure.');
  await client.close();
  process.exit(1);
}

const cardsRemoved = list.find('.uni-card').length;
list.html(MARKER);
const templated = $('body').html() ?? '';

console.log(`cards replaced by the marker : ${cardsRemoved}`);
console.log(`size                         : ${page.contentHtml.length} -> ${templated.length}`);
console.log(`sidebar preserved            : ${$('aside').length ? 'yes' : 'NO'}`);
console.log(`marker present in output     : ${templated.includes(MARKER) ? 'yes' : 'NO'}`);

if (cardsRemoved === 0) {
  console.error('\nFATAL: no cards found to replace — aborting rather than writing a stub.');
  await client.close();
  process.exit(1);
}

if (APPLY) {
  // The original stays under `contentHtmlOriginal` as an in-database rollback.
  await pages.updateOne(
    { path: '/university' },
    { $set: { contentHtml: templated, contentHtmlOriginal: page.contentHtml } }
  );
  console.log('\nwritten; original kept as contentHtmlOriginal');
} else {
  console.log('\nRe-run with --apply to write.');
}

await client.close();
