import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Pixel-perfect port constraints:
   * - `unoptimized` is a guard. The live site uses plain eager <img> with no
   *   lazy-loading, srcset or <picture>; next/image would inject wrappers and
   *   change intrinsic sizing, so it is not used anywhere in this project.
   * - No PostCSS/Tailwind config exists on purpose: every stylesheet is served
   *   verbatim from /public so the browser receives byte-identical CSS.
   * - The dev indicator overlays the viewport and corrupts screenshot diffs.
   */
  images: { unoptimized: true },
  devIndicators: false,

  /**
   * The reference site 302-redirects /course to /course/online (captured in
   * data/inventory.json). Replicated so the link from the header/footer resolves
   * the same way rather than 404ing.
   */
  async redirects() {
    return [{ source: '/course', destination: '/course/online', permanent: false }];
  },
};

export default nextConfig;
