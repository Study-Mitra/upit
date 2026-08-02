import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ComparePage from '@/components/templates/ComparePage';
import { getUniversities } from '@/lib/models/universities';

/**
 * /compare/{slug}/{slug}[/{slug}]
 *
 * Rendered on demand, never prerendered: 19 universities produce 171 pairs and
 * 969 triples. The reference accepts 2 or 3 slugs (the client only ever builds
 * those), so anything else 404s.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Compare Result | UPIT College of Education',
};

export default async function Compare({
  params,
}: {
  params: Promise<{ slugs: string[] }>;
}) {
  const { slugs } = await params;
  if (!slugs || slugs.length < 2 || slugs.length > 3) notFound();

  const all = await getUniversities();
  const bySlug = new Map(all.map((u) => [u.slug, u]));
  const selected = slugs.map((s) => bySlug.get(s)).filter(Boolean);

  // An unknown slug means a hand-typed or stale URL.
  if (selected.length !== slugs.length) notFound();

  return <ComparePage universities={selected as NonNullable<(typeof selected)[number]>[]} />;
}
