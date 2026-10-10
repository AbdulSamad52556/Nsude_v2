import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCollectionPage } from "@/lib/server/collections";
import { ProductGrid } from "@/components/product/ProductGrid";
import { CollectionBanner } from "@/components/collections/CollectionBanner";
import { BackButton } from "@/components/ui/BackButton";

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
      <BackButton fallbackHref="/collections" label="Back" className="-ml-1 mb-4" />

      <CollectionBanner c={c} heading="h1" priority eyebrow="Collection" />

      {c.description ? (
        <p className="mb-10 mt-10 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-graphite md:mb-14 md:mt-12 md:text-base">
          {c.description}
        </p>
      ) : (
        <div className="h-10 md:h-12" />
      )}
      <ProductGrid cards={c.cards} layout="shop" />
    </div>
  );
}
