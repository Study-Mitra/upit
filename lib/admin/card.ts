import type { University } from '@/lib/models/universities';

/**
 * The single producer of university listing-card markup.
 *
 * WHY THIS EXISTS
 * /filter-course, /filter-price and /filter-mode-study each return
 * `unis.map(u => u.cardHtml).join('\n')` straight to the browser. Keeping
 * `cardHtml` as a stored, regenerated-on-save field means those three endpoints
 * need no changes at all, and the card markup lives in exactly one place instead
 * of being hand-authored per college.
 *
 * NOT BYTE-IDENTICAL TO THE ORIGINAL, BY DECISION
 * The imported cardHtml carries Blade-template indentation and an artifact
 * (`</p><p data-start="493" data-end="959">`) produced by feeding raw HTML
 * through a truncate filter. Reproducing that byte-for-byte would be brittle and
 * pointless: the markup is consumed by a browser, not diffed. Every class, data
 * attribute and element the site's JavaScript and CSS depend on is preserved:
 *
 *   .uni-card[data-url][data-courses][data-modes][id]  card click-through + filters
 *   .uni-logo                                          read by inline-08.js fallback
 *   .uni-name                                          read by inline-08.js fallback
 *   .compare-uni[data-id][data-logo][data-name]        the compare widget
 *   .upit-approval-badge                                approval pills
 */

/** Escape for use in an HTML attribute value or text node. */
function esc(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Card blurbs are one truncated sentence; strip any markup the excerpt carries. */
function plainExcerpt(html: string, limit = 180): string {
  const text = String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).replace(/\s+\S*$/, '')}…`;
}

export function renderUniversityCard(u: University): string {
  const href = `/university/${u.slug}`;
  const name = esc(u.name);
  const banner = esc(u.banner || u.logo);
  const logo = esc(u.logo);
  const compareId = esc(u.compareId ?? '');
  const badges = (u.badges ?? []).filter(Boolean);

  const badgeHtml = badges.length
    ? `<span style="color:#d1d5db;">|</span>` +
      badges.map((b) => `<span class="upit-approval-badge">${esc(b)}</span>`).join('')
    : '';

  // The `.course-grid-3` wrapper is included deliberately.
  //
  // The listing's filter scripts do `$('#university-list').html(response)`, and
  // the stored cardHtml did not carry this wrapper — so the grid was laid out on
  // `.course-grid-3` children initially but on bare `.uni-card` children after a
  // filter, shifting the layout. Emitting it here means the server-rendered
  // listing and every filtered response are structurally identical.
  //
  // data-courses / data-modes are the filter keys the listing's AJAX reads.
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
