'use client';

import { useState } from 'react';
import { pageScriptsFor } from '@/lib/page-scripts';

/**
 * Registers a page's own inline scripts so VendorScripts can run them at the
 * end of the vendor chain.
 *
 * Why a registry rather than props: VendorScripts lives in the root layout and
 * has no knowledge of the current route, while the scripts must execute AFTER
 * jQuery, Swiper and main.js. React runs child effects before parent effects on
 * mount, so a page-level component registering during render is guaranteed to
 * be visible to the layout-level loader.
 *
 * Registration happens during render (not in an effect) so it is recorded even
 * on the very first pass, before any effect fires.
 */
const registry: { srcs: string[] } = { srcs: [] };

export function getRegisteredPageScripts(): string[] {
  return registry.srcs;
}

export default function PageScripts({ path }: { path: string }) {
  // useState initialiser runs exactly once per mount, during render.
  useState(() => {
    registry.srcs = pageScriptsFor(path);
    return null;
  });
  return null;
}
