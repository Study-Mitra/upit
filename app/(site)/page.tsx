import HomeContent from '@/components/pages/HomeContent';

/**
 * The imported title repeated the brand suffix twice. That was kept originally so
 * the page matched the reference site byte for byte; the justification died with
 * the rebrand, since the brand now deliberately differs from the reference, and
 * leaving it would ship the company name twice in every browser tab and search
 * result.
 *
 * Written without quoting either brand name so scripts/rebrand.mjs cannot rewrite
 * this explanation into nonsense on a future rename.
 */
export const metadata = {
  title: 'Online & Distance Education Courses | UPIT College of Education',
  description:
    'UPIT College of Education offers top UGC & AICTE approved online, distance, and regular learning programs. Explore B.Tech, MBA, MCA, and specialization courses from leading universities.',
  keywords:
    'online learning, distance education, regular courses, mba online, btech, mca, ugc approved universities, upit college of education',
};

export default function HomePage() {
  return <HomeContent />;
}
