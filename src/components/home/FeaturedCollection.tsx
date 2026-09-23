import { getFeaturedProducts } from "@/lib/products";
import { ProductCard } from "@/components/product/ProductCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";

export function FeaturedCollection() {
  const [first, second, third, fourth] = getFeaturedProducts();

  return (
    <section className="bg-bone px-5 py-28 md:px-10 md:py-36">
      <div className="mx-auto max-w-content">
        <SectionHeading
          eyebrow="Selected Pieces"
          title="The Essentials"
          subtitle="Designed to disappear into your wardrobe. Built to stand out from everything else."
          className="mb-16 md:mb-24"
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
          <Reveal className="md:col-span-7" y={40}>
            <ProductCard product={first} priority imageAspect="aspect-[3/4] md:aspect-[4/5]" />
          </Reveal>

          <div className="flex flex-col gap-6 md:col-span-5 md:gap-8">
            <Reveal delay={0.1} y={40}>
              <ProductCard product={second} imageAspect="aspect-[4/3]" />
            </Reveal>
            <Reveal delay={0.2} y={40}>
              <ProductCard product={third} imageAspect="aspect-[4/3]" />
            </Reveal>
          </div>

          <Reveal delay={0.15} y={40} className="md:col-span-12">
            <ProductCard product={fourth} imageAspect="aspect-[16/9]" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
