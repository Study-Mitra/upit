import type { ReactNode } from 'react';
import { logout } from '@/app/(admin)/admin/logout/actions';

/**
 * Sidebar + main chrome for every signed-in admin page.
 *
 * A component rather than a nested layout: a layout at app/(admin)/admin/layout.tsx
 * would also wrap /admin/login, which must render the bare centred .a-login card
 * with no sidebar.
 *
 * Class names come from app/(admin)/admin.css, which is already written in full —
 * match it rather than inventing new classes.
 */
export type NavCounts = {
  colleges: number;
  courses: number;
  pages: number;
  leads: number;
};

const NAV: { key: keyof NavCounts; label: string; href: string }[] = [
  { key: 'colleges', label: 'Colleges', href: '/admin/colleges' },
  { key: 'courses', label: 'Courses', href: '/admin/courses' },
  { key: 'pages', label: 'Pages', href: '/admin/pages' },
  { key: 'leads', label: 'Leads', href: '/admin/leads' },
];

export default function AdminShell({
  current,
  email,
  counts,
  title,
  subtitle,
  actions,
  children,
}: {
  current: 'dashboard' | keyof NavCounts;
  email: string;
  counts: NavCounts;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="a-shell">
      <nav className="a-sidebar">
        <div className="a-brand">
          SRM <span>Admin</span>
        </div>

        <a className={`a-nav-link${current === 'dashboard' ? ' active' : ''}`} href="/admin">
          Dashboard
        </a>

        {NAV.map((item) => (
          <a
            key={item.key}
            className={`a-nav-link${current === item.key ? ' active' : ''}`}
            href={item.href}
          >
            <span>{item.label}</span>
            <span className="a-nav-count">{counts[item.key]}</span>
          </a>
        ))}

        <div className="a-sidebar-footer">
          <div style={{ marginBottom: 8 }}>{email}</div>
          <form action={logout}>
            <button className="a-btn" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <main className="a-main">
        <header className="a-header">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </header>
        {children}
      </main>
    </div>
  );
}
