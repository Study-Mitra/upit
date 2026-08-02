import type { ReactNode } from 'react';
import { STYLESHEETS } from '@/lib/assets';
import VendorScripts from '@/components/VendorScripts';
import { CHROME_STYLE_BLOCKS } from '@/components/chrome/styleBlocks';

import LoaderModalTop from '@/components/chrome/LoaderModalTop';
import LoaderModalBottom from '@/components/chrome/LoaderModalBottom';
import Header from '@/components/chrome/Header';
import MobileMenu from '@/components/chrome/MobileMenu';
import Footer from '@/components/chrome/Footer';
import BackToTop from '@/components/chrome/BackToTop';
import LeadModal from '@/components/chrome/LeadModal';
import CompareModal from '@/components/chrome/CompareModal';
import FloatingCompareBtn from '@/components/chrome/FloatingCompareBtn';
import WhatsAppFloat from '@/components/chrome/WhatsAppFloat';

/**
 * NOTE: no `import './globals.css'` and no next/font here, deliberately.
 * Stylesheets are served verbatim from /public via plain <link> tags so the
 * browser receives byte-identical CSS in the identical cascade order, and fonts
 * are self-hosted through euclid-circulara.css — next/font would rewrite
 * @font-face and inject fallback metrics that shift text rendering.
 */

/**
 * Structured data lifted from the live <head>, with the company details updated
 * for the rebrand.
 *
 * The postal address is stored field-by-field here, and in a different format
 * from the single string rendered in the header and footer, so
 * scripts/rebrand.mjs cannot reach it with a string replacement — it is
 * maintained by hand and must be updated alongside them. This is the address
 * Google reads, so a stale value here outlives the visible one on the page.
 *
 * No literal old address is quoted above, so a grep for the previous details
 * returns nothing once a move is complete.
 */
const JSONLD_ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'EducationalOrganization',
  name: 'UPIT College of Education',
  url: 'https://srmflexilearn.com',
  logo: 'https://srmflexilearn.com/new-assets/img/upit_logo.png',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+91 9818031375',
    contactType: 'customer service',
    email: 'support@upitcollege.com',
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'A 1278, Mayur Vihar, Phase-III',
    addressLocality: 'Delhi',
    addressRegion: 'Delhi',
    postalCode: '110096',
    addressCountry: 'IN',
  },
  sameAs: [
    'https://www.facebook.com/profile.php?id=61590632371785',
    '',
    'https://www.instagram.com/srmflexilearn',
    '',
    '',
  ],
};

/**
 * The SearchAction target keeps the live site's `?query=` during visual
 * verification. Phase 6 corrects it to `search_val`, which is the parameter the
 * site's own JavaScript actually sends.
 */
const JSONLD_WEBSITE = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'UPIT College of Education',
  url: 'https://srmflexilearn.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://srmflexilearn.com/getSearchResults?query={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="x-ua-compatible" content="ie=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD_ORGANIZATION) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD_WEBSITE) }}
        />
        <link
          rel="shortcut icon"
          type="image/x-icon"
          href="/new-assets/img/upit_logo.png"
        />
        {/* Order is load-bearing: styles.css is last so it wins the cascade. */}
        {STYLESHEETS.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        {/* Page-level <style> blocks from the live markup. Several rules use
            !important, so these must come after every stylesheet. */}
        {CHROME_STYLE_BLOCKS.map((css, i) => (
          <style key={i} dangerouslySetInnerHTML={{ __html: css }} />
        ))}
      </head>
      <body>
        {/* Body order mirrors the live DOM exactly. */}
        <LoaderModalTop />
        <Header />
        <MobileMenu />

        {children}

        <LoaderModalBottom />
        <Footer />
        <BackToTop />
        <LeadModal />
        <CompareModal />
        <FloatingCompareBtn />
        <WhatsAppFloat />

        <VendorScripts />
      </body>
    </html>
  );
}
