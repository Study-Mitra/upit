import type { ReactNode } from 'react';
import './admin.css';

/**
 * Admin root layout — deliberately separate from the site's.
 *
 * This is a SECOND root layout (Next.js route groups allow one per group). The
 * admin must not load styles.css, the 26 vendor scripts or the site chrome:
 * those exist to reproduce the reference site pixel-for-pixel, and they would
 * fight a normal application UI. Everything here is ordinary modern Next.js.
 */
export const metadata = {
  title: 'UPIT College of Education — Admin',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
