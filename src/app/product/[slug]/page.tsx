import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts, products } from "@/lib/products";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { ProductGrid } from "@/components/product/ProductGrid";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const product = getProductBySlug(params.slug);
  if (!product) return {};

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: `${product.name} — NSUDE`,
      description: product.description,
      images: [{ url: product.images[0].src }],
    },
  };
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();

  const related = getRelatedProducts(product.slug, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((i) => i.src),
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: product.price,
      availability:
        product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="px-5 pb-24 pt-28 md:px-10 md:pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="mx-auto mb-8 max-w-content text-xs uppercase tracking-wide text-ash">
        <a href="/shop" className="hover:text-ink">
          Shop
        </a>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="mx-auto grid max-w-content grid-cols-1 gap-10 md:grid-cols-2 md:gap-16">
        <ProductGallery images={product.images} />
        <div className="md:sticky md:top-28 md:h-fit">
          <ProductInfo product={product} />
        </div>
      </div>

      <div className="mx-auto mt-28 max-w-content md:mt-36">
        <SectionHeading title="You May Also Like" className="mb-12" />
        <ProductGrid products={related} />
      </div>
    </div>
  );
}
