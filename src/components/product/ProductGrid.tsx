import { ProductListing } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { Reveal } from "@/components/ui/Reveal";

/** Grid of product cards, one per listing (a product in a given color). */
export function ProductGrid({ listings }: { listings: ProductListing[] }) {
  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-32 text-center">
        <p className="text-sm uppercase tracking-widest2 text-ash">
          No products match your filters
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 md:gap-x-8 md:gap-y-16">
      {listings.map(({ product, variant }, i) => (
        <Reveal key={variant.code} delay={Math.min(i * 0.05, 0.3)}>
          <ProductCard product={product} variant={variant} priority={i < 3} />
        </Reveal>
      ))}
    </div>
  );
}
