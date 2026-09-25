import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getListingByCode, getProducts, getRelatedProducts } from "@/lib/server/products";
import { ProductView } from "@/components/product/ProductView";
import { ProductGrid } from "@/components/product/ProductGrid";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { priceRange, productHref, totalStock } from "@/lib/types";

// One page per colorway, addressed by its product code (/product/7K2Q).
// All are pre-rendered at build; colors added later in /admin render on
// first visit and are cached after that.
export async function generateStaticParams() {
  const products = await getProducts();
  return products.flatMap((p) => p.variants.map((v) => ({ code: v.code })));
}

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const listing = await getListingByCode(params.code);
  if (!listing) return {};
  const { product, variant } = listing;
  const title = `${product.name} — ${variant.name}`;

  return {
    title,
    description: product.description,
    alternates: { canonical: productHref(variant) },
    openGraph: {
      title: `${title} — NSUDE`,
      description: product.description,
      images: variant.images[0] ? [{ url: variant.images[0].src }] : [],
    },
  };
}

export default async function ProductPage({ params }: { params: { code: string } }) {
  const listing = await getListingByCode(params.code);
  if (!listing) notFound();
  const { product, variant } = listing;
  // Codes are uppercase; send lowercase/mixed-case links to the canonical URL.
  if (params.code !== variant.code) redirect(productHref(variant));

  const related = await getRelatedProducts(product, 3);

  // One offer per colorway, each with its own URL, price range and
  // availability; the aggregate spans every color and size.
  const overall = priceRange(product, product.variants);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: variant.code,
    color: variant.name,
    description: product.description,
    image: variant.images.map((i) => i.src),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: overall.min,
      highPrice: overall.max,
      offerCount: product.variants.length,
      availability:
        totalStock(product) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      offers: product.variants.map((v) => ({
        "@type": "Offer",
        sku: v.code,
        name: `${product.name} — ${v.name}`,
        url: productHref(v),
        priceCurrency: "INR",
        price: priceRange(product, [v]).min,
        availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      })),
    },
  };

  return (
    <div className="px-5 pb-24 pt-28 md:px-10 md:pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="mx-auto mb-8 max-w-content text-xs uppercase tracking-wide text-ash">
        <Link href="/shop" className="hover:text-ink">
          Shop
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <ProductView product={product} initialCode={variant.code} />

      {related.length > 0 && (
        <div className="mx-auto mt-28 max-w-content md:mt-36">
          <SectionHeading title="You May Also Like" className="mb-12" />
          <ProductGrid listings={related.map((p) => ({ product: p, variant: p.variants[0] }))} />
        </div>
      )}
    </div>
  );
}
