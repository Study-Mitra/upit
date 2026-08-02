import Breadcrumb from './Breadcrumb';
import type { Course } from '@/lib/models/courses';

/**
 * /course/online and /course/regular — the two tabbed listing pages.
 *
 * Their body is a rendered index of other courses driven by a Bootstrap tab
 * system with jQuery-managed state. It is preserved as raw HTML rather than
 * recomposed: the tab pane ids, aria wiring and active-state classes are
 * interdependent, and regenerating them risks breaking the tabs for no gain.
 * The underlying course records remain individually editable via /admin.
 */
export default function CourseListing({ course }: { course: Course }) {
  return (
    <>
      <Breadcrumb
        title={course.name}
        crumbs={[{ label: 'Home', href: '/' }, { label: course.name }]}
      />
      <div dangerouslySetInnerHTML={{ __html: course.bodyHtml ?? '' }} />
    </>
  );
}
