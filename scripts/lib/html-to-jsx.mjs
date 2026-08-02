/**
 * HTML -> JSX source converter.
 *
 * This is the backbone of the pixel-perfect port: every template component is
 * generated from the real crawled markup rather than hand-retyped, so class
 * names, attribute order, whitespace and text nodes survive intact.
 *
 * Guarantees:
 *  - React-reserved attribute names are remapped (class -> className, etc.)
 *  - inline style strings become style objects
 *  - void elements self-close
 *  - <script>/<style> bodies go through dangerouslySetInnerHTML so their
 *    contents are never parsed as JSX
 *  - text is escaped so { } < > in copy cannot break the output
 */
import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';

/** Attributes React spells differently from HTML. */
const ATTR_MAP = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  maxlength: 'maxLength',
  minlength: 'minLength',
  readonly: 'readOnly',
  contenteditable: 'contentEditable',
  spellcheck: 'spellCheck',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  autoplay: 'autoPlay',
  enctype: 'encType',
  novalidate: 'noValidate',
  formaction: 'formAction',
  usemap: 'useMap',
  datetime: 'dateTime',
  srcset: 'srcSet',
  crossorigin: 'crossOrigin',
  playsinline: 'playsInline',
  frameborder: 'frameBorder',
  allowfullscreen: 'allowFullScreen',
  marginwidth: 'marginWidth',
  marginheight: 'marginHeight',
  accesskey: 'accessKey',
  itemprop: 'itemProp',
  itemscope: 'itemScope',
  itemtype: 'itemType',
  'http-equiv': 'httpEquiv',
  charset: 'charSet',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  valign: 'vAlign',
  srclang: 'srcLang',
  hreflang: 'hrefLang',
};

/** Boolean attributes: React wants `attr` -> `attr={true}`. */
const BOOLEAN_ATTRS = new Set([
  'checked', 'disabled', 'readonly', 'required', 'selected', 'multiple',
  'autofocus', 'autoplay', 'controls', 'defer', 'hidden', 'loop', 'muted',
  'novalidate', 'open', 'reversed', 'scoped', 'async', 'playsinline',
  'allowfullscreen', 'itemscope',
]);

/**
 * Attributes React types as `number`. Emitting them as strings is a type error,
 * and coercing at runtime would be a silent mismatch, so integer-valued ones are
 * converted here. Non-integer values (e.g. width="100%") are left as strings.
 */
const NUMERIC_ATTRS = new Set([
  'tabindex', 'maxlength', 'minlength', 'rows', 'cols', 'size', 'span', 'start',
]);

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr',
]);

/** SVG/HTML attributes that must keep their exact casing in React. */
const CASE_SENSITIVE = {
  viewbox: 'viewBox',
  preserveaspectratio: 'preserveAspectRatio',
  stroketaperture: 'strokeTaperture',
  strokewidth: 'strokeWidth',
  strokelinecap: 'strokeLinecap',
  strokelinejoin: 'strokeLinejoin',
  strokedasharray: 'strokeDasharray',
  strokedashoffset: 'strokeDashoffset',
  strokemiterlimit: 'strokeMiterlimit',
  strokeopacity: 'strokeOpacity',
  fillopacity: 'fillOpacity',
  fillrule: 'fillRule',
  cliprule: 'clipRule',
  clippath: 'clipPath',
  stopcolor: 'stopColor',
  stopopacity: 'stopOpacity',
  gradientunits: 'gradientUnits',
  gradienttransform: 'gradientTransform',
  patternunits: 'patternUnits',
  markerwidth: 'markerWidth',
  markerheight: 'markerHeight',
  markerend: 'markerEnd',
  markerstart: 'markerStart',
  textanchor: 'textAnchor',
  dominantbaseline: 'dominantBaseline',
  fontfamily: 'fontFamily',
  fontsize: 'fontSize',
  fontweight: 'fontWeight',
  letterspacing: 'letterSpacing',
  xmlnsxlink: 'xmlnsXlink',
  baseprofile: 'baseProfile',
  shaperendering: 'shapeRendering',
  vectoreffect: 'vectorEffect',
  paintorder: 'paintOrder',
};

/** kebab-case CSS property -> camelCase JS property. */
function cssPropToJs(prop) {
  const p = prop.trim();
  if (p.startsWith('--')) return p; // CSS custom properties keep their name
  if (p.startsWith('-ms-')) return 'ms' + p.slice(4).replace(/-(\w)/g, (_, c) => c.toUpperCase());
  return p.replace(/^-/, '').replace(/-(\w)/g, (_, c) => c.toUpperCase());
}

/**
 * Convert an inline style string into a JSX style-object literal.
 *
 * React's style object cannot express `!important` — it silently drops it — so
 * any declaration block containing one is NOT converted here. The caller
 * instead tags the element with data-pxs="sN" and emits the original block as a
 * high-specificity CSS rule (see collectImportantStyle below). That preserves
 * the exact declarations, which matters because these drive visible badge
 * colours on the live site.
 */
function styleToObject(styleStr) {
  const entries = [];
  // Split on ; that are not inside url(...) or quotes.
  const decls = styleStr.split(/;(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
  for (const decl of decls) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (!prop) continue;
    const key = cssPropToJs(prop);
    entries.push(`${/^[a-zA-Z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${JSON.stringify(value)}`);
  }
  return entries.length ? `{{ ${entries.join(', ')} }}` : null;
}

/** Elements whose text content must survive byte-for-byte. */
const PRESERVE_WHITESPACE = new Set(['pre', 'textarea']);

/**
 * Render a text node as JSX.
 *
 * Whitespace is load-bearing. A whitespace-only run between two inline elements
 * collapses to a single RENDERED space in HTML, but JSX drops whitespace-only
 * lines entirely — silently narrowing inline-block layouts. (This cost ~3.9px on
 * the header's "Apply Now" button.) So whitespace-only nodes become an explicit
 * {" "}, and nodes with leading/trailing whitespace are emitted as string
 * expressions with HTML's collapsing already applied.
 */
function textNodeToJsx(raw, parentTag) {
  if (PRESERVE_WHITESPACE.has(parentTag)) return `{${JSON.stringify(raw)}}`;

  if (!raw.trim()) return `{" "}`;

  // Reproduce HTML whitespace collapsing.
  const collapsed = raw.replace(/\s+/g, ' ');
  const hasBoundarySpace = /^\s/.test(raw) || /\s$/.test(raw);

  if (hasBoundarySpace) return `{${JSON.stringify(collapsed)}}`;

  // Safe as literal JSX text: no boundary whitespace to lose.
  return collapsed.replace(/([{}])/g, '{"$1"}').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attrName(name) {
  const lower = name.toLowerCase();
  if (ATTR_MAP[lower]) return ATTR_MAP[lower];
  if (CASE_SENSITIVE[lower]) return CASE_SENSITIVE[lower];
  // data-* / aria-* keep their hyphens in JSX.
  if (lower.startsWith('data-') || lower.startsWith('aria-')) return lower;
  // Namespaced attrs (xlink:href, xmlns:xlink) — React accepts the colon form
  // only for a few; normalise the common ones.
  if (lower === 'xlink:href') return 'xlinkHref';
  if (lower === 'xmlns:xlink') return 'xmlnsXlink';
  return name;
}

/** Absolute links back to the live origin must become site-relative, or the
 *  clone would navigate users away to the original site. */
const LIVE_ORIGIN = /https?:\/\/(?:www\.)?srmflexilearn\.com/g;

export function stripOrigin(value) {
  if (typeof value !== 'string') return value;
  // Leave a bare origin as '/' rather than an empty string.
  return value.replace(LIVE_ORIGIN, '').replace(/^(['"]?)$/, '$1');
}

/**
 * @param {string} html raw HTML fragment
 * @param {object} [opts]
 * @param {(src: string) => string} [opts.rewriteAsset] rewrite src/href asset URLs
 * @returns {{ jsx: string, warnings: object[], importantStyles: string[] }}
 *   importantStyles — CSS rule text for every inline style block that used
 *   !important; the caller must emit these in a stylesheet loaded last.
 */
export function htmlToJsx(html, opts = {}) {
  const { rewriteAsset } = opts;
  const warnings = [];
  const $ = cheerio.load(html, { xml: false }, false);

  /** Deduplicated map of original style string -> stable token. */
  const importantMap = new Map();

  /**
   * Tokens are content-hashed rather than sequential so that separate generator
   * runs (chrome, each page template) produce identical tokens for identical
   * style blocks and can never collide when merged into one stylesheet.
   */
  function collectImportantStyle(styleStr) {
    let token = importantMap.get(styleStr);
    if (!token) {
      token = 'x' + createHash('md5').update(styleStr).digest('hex').slice(0, 8);
      importantMap.set(styleStr, token);
    }
    return token;
  }

  function convertNode(node, depth) {
    const pad = '  '.repeat(depth);

    if (node.type === 'text') {
      return textNodeToJsx(node.data ?? '', node.parent?.name ?? '');
    }

    if (node.type === 'comment') {
      return `{/*${node.data.replace(/\*\//g, '*\\/')}*/}`;
    }

    if (node.type === 'script' || node.type === 'style' || node.name === 'script' || node.name === 'style') {
      const inner = $(node).html() ?? '';
      const attrs = buildAttrs(node, `<${node.name}>`);
      // Inline bodies must never be parsed as JSX.
      if (inner.trim()) {
        return `${pad}<${node.name}${attrs} dangerouslySetInnerHTML={{ __html: ${JSON.stringify(inner)} }} />`;
      }
      return `${pad}<${node.name}${attrs} />`;
    }

    if (node.type !== 'tag') return '';

    const tag = node.name;
    const attrs = buildAttrs(node, `<${tag}>`);

    if (VOID_ELEMENTS.has(tag)) return `${pad}<${tag}${attrs} />`;

    const children = (node.children ?? [])
      .map((c) => convertNode(c, depth + 1))
      .filter((s) => s !== '');

    if (!children.length) return `${pad}<${tag}${attrs}></${tag}>`;

    // Keep short pure-text elements on one line. The children are already
    // whitespace-exact, so they are joined without trimming.
    const onlyText = (node.children ?? []).every((c) => c.type === 'text');
    if (onlyText) {
      const text = children.join('');
      if (text.length < 100) return `${pad}<${tag}${attrs}>${text}</${tag}>`;
    }

    return `${pad}<${tag}${attrs}>\n${children.join('\n')}\n${pad}</${tag}>`;
  }

  function buildAttrs(node, context) {
    const out = [];
    /** Attributes React's per-element types reject but that must still render. */
    const spreads = [];

    for (const [rawName, rawValue] of Object.entries(node.attribs ?? {})) {
      const lower = rawName.toLowerCase();

      // The live markup puts `for` on <p> error placeholders (invalid HTML, but
      // present in the DOM). React renders htmlFor on any element at runtime;
      // only TypeScript's per-element prop types object. Spreading through an
      // erased type keeps the rendered DOM identical.
      if (lower === 'for' && node.name !== 'label' && node.name !== 'output') {
        spreads.push(`{...({ htmlFor: ${JSON.stringify(rawValue)} } as {})}`);
        continue;
      }

      if (NUMERIC_ATTRS.has(lower) && /^-?\d+$/.test(rawValue.trim())) {
        out.push(`${attrName(rawName)}={${parseInt(rawValue, 10)}}`);
        continue;
      }

      if (lower === 'style') {
        if (/!important/i.test(rawValue)) {
          // Preserved verbatim as a CSS rule instead — React would drop the
          // !important and change how these elements render.
          const token = collectImportantStyle(rawValue);
          warnings.push({ type: 'important-inline-style', context, decl: rawValue, token });
          out.push(`data-pxs=${JSON.stringify(token)}`);
          continue;
        }
        const obj = styleToObject(rawValue);
        if (obj) out.push(`style=${obj}`);
        continue;
      }

      // Inline event handlers cannot survive as JSX string attributes. The live
      // site uses them (e.g. onclick="window.location=..."), so they are
      // preserved as data-* and rebound at runtime by INLINE_HANDLER_SHIM.
      // Absolute origin URLs inside the handler body are stripped so navigation
      // stays on this site rather than bouncing to the live one.
      if (lower.startsWith('on')) {
        const code = stripOrigin(rawValue);
        warnings.push({ type: 'inline-handler', context, attr: lower, value: code });
        out.push(`data-inline-${lower}=${JSON.stringify(code)}`);
        continue;
      }

      // Applied to every attribute, not just src/href: data-logo and data-url
      // also carry absolute origin URLs, and the compare modal builds
      // <img src="${uni.logo}"> from data-logo. Safe for mailto:/tel: because
      // the pattern requires an https?:// prefix.
      let value = stripOrigin(rawValue);
      if (rewriteAsset && (lower === 'src' || lower === 'href' || lower === 'poster')) {
        value = rewriteAsset(value);
      }

      const name = attrName(rawName);

      if (BOOLEAN_ATTRS.has(lower) && (value === '' || value === rawName || value === lower)) {
        out.push(`${name}={true}`);
        continue;
      }

      out.push(`${name}=${JSON.stringify(value)}`);
    }
    const all = [...out, ...spreads];
    return all.length ? ' ' + all.join(' ') : '';
  }

  const roots = $.root()[0].children ?? [];
  const jsx = roots
    .map((n) => convertNode(n, 0))
    .filter((s) => s.trim() !== '')
    .join('\n');

  /**
   * The attribute selector is repeated to raise specificity to (0,4,0). An
   * inline `!important` declaration outranks every author stylesheet rule, so
   * the replacement must outrank the most specific competing rule in
   * styles.css — the highest found is `.active-dark-mode .rbt-badge.variation-02`
   * at (0,3,0), which applies once dark mode is toggled on.
   */
  const importantStyles = [...importantMap.entries()].map(
    ([decls, token]) =>
      `[data-pxs="${token}"][data-pxs][data-pxs][data-pxs] { ${decls.trim().replace(/;?$/, ';')} }`
  );

  return { jsx, warnings, importantStyles };
}
