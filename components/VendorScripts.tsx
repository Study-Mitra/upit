'use client';

import { useEffect } from 'react';
import { VENDOR_SCRIPTS } from '@/lib/assets';
import { INLINE_SCRIPTS } from '@/lib/inline-scripts';
import { getRegisteredPageScripts } from '@/components/PageScripts';

/**
 * Deterministic, ordered script loader.
 *
 * The live site is a jQuery/Bootstrap theme where load order is load-bearing:
 * jQuery must exist before every plugin, main.js after all of them. next/script
 * does not guarantee cross-strategy ordering, so scripts are appended one at a
 * time, each awaiting the previous script's onload.
 *
 * READINESS SEMANTICS
 * On the live page every one of these is a synchronous in-body <script>, so the
 * parser is still running while they execute: DOMContentLoaded — and therefore
 * every $(document).ready callback — fires only after ALL of them have run.
 * Several scripts depend on that. paralax-scroll.js, for instance, calls
 * ParallaxScroll.init() inside $(document).ready, and ParallaxScroll is defined
 * by paralax.min.js which loads two files later.
 *
 * This loader runs after hydration, when the document is already complete, so
 * naive injection would fire ready callbacks too early. Two mechanisms restore
 * the original ordering:
 *   1. jQuery.holdReady(true) as soon as jQuery exists, released once the whole
 *      chain has finished.
 *   2. Late DOMContentLoaded/load listeners are queued rather than dropped
 *      (they would otherwise never fire) and flushed at the same point.
 *
 * Each inline block is loaded as its OWN <script> (see scripts/gen-inline-js.mjs)
 * so a throw in one aborts only that block, exactly as in the original.
 */

/** Module-level guard: survives React StrictMode's double-invoked effects. */
let started = false;

/**
 * main.js calls eduJs.editor() unconditionally, and editor() calls
 * Jodit.plugins.add(...) with no existence guard. Since jodit.min.js (655 KB) is
 * dropped, an undefined `Jodit` would throw a ReferenceError and abort every
 * initializer registered after editor() — toggleModal, dnd, multiStepForm and
 * cursorFollow would silently stop running.
 *
 * Behaviourally identical on public pages: Jodit.make() is only reached when
 * #editor1/#editor2/#editor3 exist, and those appear on none of the 162 pages.
 */
const JODIT_STUB = `
window.Jodit = window.Jodit || {
  plugins: { add: function () {} },
  make: function () { return null; },
  modules: { Helpers: { trim: function (s) { return String(s == null ? '' : s).trim(); } } }
};
`;

/** Queues late DOMContentLoaded/load listeners; flushed by READY_FLUSH. */
const READY_SHIM = `
(function () {
  window.__pxReadyQueue = { dom: [], load: [] };
  var docAdd = document.addEventListener.bind(document);
  document.addEventListener = function (type, fn, opts) {
    if (type === 'DOMContentLoaded' && document.readyState !== 'loading' && typeof fn === 'function') {
      window.__pxReadyQueue.dom.push(fn);
      return;
    }
    return docAdd(type, fn, opts);
  };
  var winAdd = window.addEventListener.bind(window);
  window.addEventListener = function (type, fn, opts) {
    if (type === 'load' && document.readyState === 'complete' && typeof fn === 'function') {
      window.__pxReadyQueue.load.push(fn);
      return;
    }
    return winAdd(type, fn, opts);
  };
})();
`;

/**
 * Release point. Mirrors the live page's ordering: DOMContentLoaded listeners,
 * then jQuery's ready queue, then load listeners.
 */
const READY_FLUSH = `
(function () {
  var q = window.__pxReadyQueue || { dom: [], load: [] };
  var run = function (fns, evtName) {
    for (var i = 0; i < fns.length; i++) {
      try { fns[i](new Event(evtName)); } catch (e) { console.error('[ready]', e); }
    }
  };
  run(q.dom, 'DOMContentLoaded');
  if (window.jQuery && window.jQuery.holdReady) window.jQuery.holdReady(false);
  run(q.load, 'load');
  q.dom = []; q.load = [];
})();
`;

/**
 * The live markup uses inline handlers (onclick="clearAllCompare()",
 * onkeypress="return isNumberKey(event)"). JSX cannot carry those as strings, so
 * the HTML->JSX converter preserved them as data-inline-on* attributes; this
 * rebinds them with identical semantics, including the `return false`
 * cancellation that onkeypress relies on.
 */
const INLINE_HANDLER_SHIM = `
(function () {
  var EVENTS = ['click', 'keypress', 'change', 'input', 'submit'];
  function bind(root) {
    var sel = EVENTS.map(function (e) { return '[data-inline-on' + e + ']'; }).join(',');
    var nodes = root.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++) {
      (function (el) {
        if (el.__pxInlineBound) return;
        el.__pxInlineBound = true;
        EVENTS.forEach(function (evt) {
          var code = el.getAttribute('data-inline-on' + evt);
          if (!code) return;
          el.addEventListener(evt, function (event) {
            try {
              var result = new Function('event', code).call(this, event);
              if (result === false) event.preventDefault();
              return result;
            } catch (err) {
              console.error('[inline-handler]', code, err);
            }
          });
        });
      })(nodes[i]);
    }
  }
  bind(document);
  // Compare rows and search results are injected by jQuery after load.
  new MutationObserver(function () { bind(document); })
    .observe(document.body, { childList: true, subtree: true });
})();
`;

function injectInline(code: string): void {
  const el = document.createElement('script');
  el.textContent = code;
  document.body.appendChild(el);
}

function injectSrc(src: string): Promise<void> {
  return new Promise((resolve) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = false;
    // Resolve on error too: the original page also survives a failed script,
    // and halting the chain would be a larger deviation than skipping one file.
    el.onload = () => resolve();
    el.onerror = () => {
      console.error('[VendorScripts] failed to load', src);
      resolve();
    };
    document.body.appendChild(el);
  });
}

declare global {
  interface Window {
    jQuery?: { holdReady?: (hold: boolean) => void };
  }
}

export default function VendorScripts() {
  useEffect(() => {
    if (started) return;
    started = true;

    (async () => {
      injectInline(READY_SHIM);
      injectInline(JODIT_STUB);

      let held = false;
      for (const src of VENDOR_SCRIPTS) {
        await injectSrc(src);
        // Hold as soon as jQuery is defined, so no plugin's ready callback can
        // run before the rest of the chain has loaded.
        if (!held && window.jQuery?.holdReady) {
          window.jQuery.holdReady(true);
          held = true;
        }
      }
      for (const src of INLINE_SCRIPTS) await injectSrc(src);

      // Page-specific scripts run last, before the ready flush. They construct
      // Swiper carousels, course filters and form handlers, and every one of
      // them assumes jQuery/Swiper/main.js already exist.
      for (const src of getRegisteredPageScripts()) await injectSrc(src);

      injectInline(INLINE_HANDLER_SHIM);
      injectInline(READY_FLUSH);
    })();
  }, []);

  return null;
}
