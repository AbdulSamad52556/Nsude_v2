import type { CardData } from "@/lib/types";
import { cx } from "@/lib/utils";
import { ProductCard } from "./ProductCard";
import { Reveal } from "@/components/ui/Reveal";

const LAYOUTS = {
  /** Related products etc.: 2 → 3 per row (4 on very wide screens). */
  default: {
    grid: "grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 md:gap-x-8 md:gap-y-16 min-[1800px]:grid-cols-4",
    imageSizes: "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  },
  /** Shop page (beside the filter sidebar): 2 → 3 → 4 → 5 → 6 per row,
      so cards keep a sensible size however wide the screen is. */
  shop: {
    grid: "grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 md:gap-y-12 xl:grid-cols-4 min-[1800px]:grid-cols-5 min-[2300px]:grid-cols-6",
    imageSizes: "(min-width: 2300px) 15vw, (min-width: 1800px) 18vw, (min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw",
  },
} as const;

/** Grid of product cards, one per colorway. */
export function ProductGrid({
  cards,
  layout = "default",
}: {
  cards: CardData[];
  layout?: keyof typeof LAYOUTS;
}) {
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-32 text-center">
        <p className="text-sm uppercase tracking-widest2 text-ash">
          No products match your filters
        </p>
      </div>
    );
  }

  const { grid, imageSizes } = LAYOUTS[layout];
  return (
    <div className={cx("grid", grid)}>
      {cards.map((card, i) => (
        // Stagger only the first rows; later pages ("Load more") appear at once.
        <Reveal key={card.code} delay={i < 8 ? i * 0.04 : 0}>
          <ProductCard card={card} priority={i < 4} imageSizes={imageSizes} />
        </Reveal>
      ))}
    </div>
  );
}
