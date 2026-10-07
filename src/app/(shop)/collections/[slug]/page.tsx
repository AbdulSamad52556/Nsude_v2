import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCollectionPage } from "@/lib/server/collections";
import { ProductGrid } from "@/components/product/ProductGrid";
import { CollectionBanner } from "@/components/collections/CollectionBanner";

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const c = await getCollectionPage(params.slug);
  if (!c) return {};
  const description = c.tagline || c.description || `The ${c.name} collection from NSUDE.`;
  const image = c.image ?? c.photos[0];
  return {
    title: `${c.name} Collection`,
    description,
    alternates: { canonical: `/collections/${c.slug}` },
    openGraph: {
      title: `${c.name} — NSUDE`,
      description,
      images: image ? [{ url: image.src }] : [],
    },
  };
}

export default async function CollectionPage({ params }: Params) {
  const c = await getCollectionPage(params.slug);
  if (!c) notFound();

  return (
    <div className="px-5 pb-24 pt-24 md:px-10 md:pb-32 md:pt-28">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs uppercase tracking-wide text-ash">
        <Link href="/collections" className="hover:text-ink">
          Collections
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{c.name}</span>
      </nav>

      <CollectionBanner c={c} heading="h1" priority eyebrow="Collection" />

      <div className="mb-10 mt-10 flex flex-col justify-between gap-4 md:mb-14 md:mt-12 md:flex-row md:items-end">
        {c.description ? (
          <p className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-graphite md:text-base">{c.description}</p>
        ) : (
          <span />
        )}
        <p className="shrink-0 text-xs uppercase tracking-widest2 text-ash">
          {c.count} {c.count === 1 ? "piece" : "pieces"}
        </p>
      </div>
      <ProductGrid cards={c.cards} layout="shop" />
    </div>
  );
}
