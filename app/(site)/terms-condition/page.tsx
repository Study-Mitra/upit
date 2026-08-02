import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import GenericPage from '@/components/templates/GenericPage';
import { getPage } from '@/lib/models/pages';

const PATH = '/terms-condition';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage(PATH);
  if (!page) return {};
  return { title: page.seo.title, description: page.seo.description, keywords: page.seo.keywords };
}

export default async function Page() {
  const page = await getPage(PATH);
  if (!page) notFound();
  return <GenericPage page={page} />;
}
