import HomeContent from '@/components/pages/HomeContent';

/**
 * The imported title carried a duplicated brand suffix
 * ("… | SRM Education | SRM Education"), kept originally so the page matched the
 * reference site byte for byte. That justification died with the rebrand — the
 * brand now deliberately differs from the reference — and leaving it would ship
 * "| UPIT College of Education" twice in the browser tab and every search result.
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
