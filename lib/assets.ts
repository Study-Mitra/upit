/**
 * Exact stylesheet and script manifests, transcribed from the live markup.
 *
 * ORDER IS LOAD-BEARING. styles.css must stay last so it wins the cascade, and
 * the vendor scripts must execute in this sequence (jQuery before every plugin,
 * main.js after all of them, sweetalert2 last).
 */

/** <link rel="stylesheet"> in the live <head>, in order. */
export const STYLESHEETS: string[] = [
  '/assets/css/vendor/bootstrap.min.css',
  '/assets/css/vendor/slick.css',
  '/assets/css/vendor/slick-theme.css',
  '/assets/css/plugins/sal.css',
  '/assets/css/plugins/feather.css',
  '/assets/css/plugins/fontawesome.min.css',
  '/assets/css/plugins/euclid-circulara.css',
  '/assets/css/plugins/swiper.css',
  '/assets/css/plugins/odometer.css',
  '/assets/css/plugins/animation.css',
  '/assets/css/plugins/bootstrap-select.min.css',
  '/assets/css/plugins/jquery-ui.css',
  '/assets/css/plugins/magnigy-popup.min.css',
  '/assets/css/plugins/plyr.css',
  // DROPPED: /assets/css/plugins/jodit.min.css (174 KB) — rich-text editor,
  // no editor element exists on any of the 162 public pages.
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  // DROPPED: glightbox.min.css — zero .glightbox elements site-wide.
  '/assets/css/styles.css',
  // Generated. Re-emits inline style="... !important" blocks that React's style
  // prop cannot express. MUST stay last so its rules win the cascade.
  '/assets/css/pixel-inline.css',
];

/**
 * Vendor scripts in exact live order.
 *
 * DROPPED, with justification:
 *  - /cdn-cgi/scripts/.../email-decode.min.js — 404s on the live site
 *  - jodit.min.js (655 KB) — see JODIT_STUB in components/VendorScripts.tsx
 *  - glightbox.min.js — loaded but GLightbox() is never called anywhere
 *  - ../../beacon.min.js/... — malformed relative path, 404s on the live site
 */
export const VENDOR_SCRIPTS: string[] = [
  '/assets/js/vendor/modernizr.min.js',
  '/assets/js/vendor/jquery.js',
  '/assets/js/vendor/bootstrap.min.js',
  '/assets/js/vendor/sal.js',
  '/assets/js/vendor/js.cookie.js',
  '/assets/js/vendor/jquery.style.switcher.js',
  '/assets/js/vendor/swiper.js',
  '/assets/js/vendor/jquery-appear.js',
  '/assets/js/vendor/odometer.js',
  '/assets/js/vendor/backtotop.js',
  '/assets/js/vendor/isotop.js',
  '/assets/js/vendor/imageloaded.js',
  '/assets/js/vendor/wow.js',
  '/assets/js/vendor/waypoint.min.js',
  '/assets/js/vendor/easypie.js',
  '/assets/js/vendor/text-type.js',
  '/assets/js/vendor/jquery-one-page-nav.js',
  '/assets/js/vendor/jquery-ui.js',
  '/assets/js/vendor/magnify-popup.min.js',
  '/assets/js/vendor/paralax-scroll.js',
  '/assets/js/vendor/paralax.min.js',
  '/assets/js/vendor/countdown.js',
  '/assets/js/vendor/plyr.js',
  '/assets/js/vendor/Sortable.min.js',
  '/assets/js/main.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
];
