import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import GenericPage from '@/components/templates/GenericPage';
import { getPage, getSlugsByFamily } from '@/lib/models/pages';

const FAMILY = 'blog';
const BASE = '/blog';

export async function generateStaticParams() {
  const slugs = await getSlugsByFamily(FAMILY);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(`${BASE}/${slug}`);
  if (!page) return {};
  return { title: page.seo.title, description: page.seo.description, keywords: page.seo.keywords };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(`${BASE}/${slug}`);
  if (!page) notFound();
  return <GenericPage page={page} />;
}
