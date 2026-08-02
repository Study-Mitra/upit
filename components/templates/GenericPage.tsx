import PageScripts from '@/components/PageScripts';
import RawContent from '@/components/templates/RawContent';
import type { PageDoc } from '@/lib/models/pages';

/** Shell shared by every non-course route: page scripts + the content region. */
export default function GenericPage({ page }: { page: PageDoc }) {
  return (
    <>
      <PageScripts path={page.path} />
      <RawContent html={page.contentHtml} />
    </>
  );
}
