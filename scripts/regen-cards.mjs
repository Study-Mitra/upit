/**
 * Regenerate every college's derived `cardHtml` from its structured fields.
 *
 *   node scripts/regen-cards.mjs            # dry run
 *   node scripts/regen-cards.mjs --apply
 *
 * `cardHtml` is a derived field: /filter-course, /filter-price and
 * /filter-mode-study each return `unis.map(u => u.cardHtml).join('\n')` straight
 * to the browser, so keeping it stored means those endpoints need no changes. The
 * admin regenerates it on every save; this backfills the colleges that were
 * imported before the generator existed.
 *
 * The generator lives in lib/admin/card.ts, which is TypeScript and cannot be
 * imported here — no TS runner is installed. The logic is therefore duplicated,
 * and tests/university-cards.mjs asserts the two agree by comparing this script's
 * stored output against what the running app serves.
 */
import { MongoClient } from 'mongodb';

const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
const DB = process.env.MONGODB_DB ?? 'srmflexilearn';
const APPLY = process.argv.includes('--apply');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function plainExcerpt(html, limit = 180) {
  const text = String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).replace(/\s+\S*$/, '')}…`;
}

function renderUniversityCard(u) {
  const href = `/university/${u.slug}`;
  const name = esc(u.name);
  const banner = esc(u.banner || u.logo);
  const logo = esc(u.logo);
  const compareId = esc(u.compareId ?? '');
  const badges = (u.badges ?? []).filter(Boolean);

  const badgeHtml = badges.length
    ? `<span style="color:#d1d5db;">|</span>` +
      badges.map((b) => `<span class="srm-approval-badge">${esc(b)}</span>`).join('')
    : '';

  return `<div class="course-grid-3 mb-4">
<div class="rbt-card variation-01 rbt-hover uni-card m-2" style="cursor: pointer;" data-url="${href}" data-courses="${esc((u.courseIds ?? []).join(','))}" data-modes="${esc((u.modeIds ?? []).join(','))}" id="${esc(u.elementId || `uni-${u.compareId ?? u.slug}`)}">
  <div class="rbt-card-img">
    <a href="${href}">
      <img src="${banner}" alt="${name}">
      <img src="${logo}" class="uni-logo" style="display:none;" alt="${name}">
    </a>
  </div>
  <div class="rbt-card-body">
    <h4 class="rbt-card-title uni-name">
      <a href="${href}">${name}</a>
    </h4>
    <div class="uni-meta">
      <i class="fas fa-map-marker-alt"></i>
      <span>${esc(u.location ?? '')}</span>
      ${badgeHtml}
    </div>
    <p class="rbt-card-text mb-2">${esc(plainExcerpt(u.excerpt ?? ''))}</p>
    <div class="rbt-card-bottom justify-content-between">
      <a class="course-btn" href="${href}">
        Learn More <i class="feather-arrow-right"></i>
      </a>
      <a href="#" class="course-btn compare-uni" data-id="${compareId}" data-logo="${logo}" data-name="${name}">
        Add Compare <i class="fas fa-balance-scale"></i>
      </a>
    </div>
  </div>
</div>
</div>`;
}

const client = await new MongoClient(URI, { serverSelectionTimeoutMS: 5000 }).connect();
const col = client.db(DB).collection('universities');
const all = await col.find({}, { projection: { _id: 0 } }).toArray();

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — ${all.length} colleges\n`);
let changed = 0;

for (const u of all) {
  const next = renderUniversityCard(u);
  const same = next === u.cardHtml;
  if (!same) changed++;
  console.log(
    `  ${u.slug.padEnd(40)} ${same ? 'unchanged' : 'REGENERATED'}  ` +
      `${String(u.cardHtml?.length ?? 0).padStart(5)} -> ${String(next.length).padStart(5)} chars` +
      (u.compareId ? '' : '   ⚠ no compareId')
  );
  if (APPLY && !same) await col.updateOne({ slug: u.slug }, { $set: { cardHtml: next } });
}

console.log(`\n${APPLY ? `wrote ${changed}` : `${changed} would change`} of ${all.length}`);
if (!APPLY) console.log('Re-run with --apply to write.');
await client.close();
