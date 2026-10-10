import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";

type Tile = {
  category: string;
  key: string;
  count: number;
  image: string | null;
  alt: string;
  subcategories: { name: string; key: string }[];
};

/** One tile per category, with a photo and how many pieces it has. */
export function ShopByCategory({ tiles }: { tiles: Tile[] }) {
  if (tiles.length === 0) return null;
  return (
    <section className="bg-paper px-5 py-24 md:px-10 md:py-32">
      <Reveal>
        <span className="mb-3 block text-xs uppercase tracking-widest2 text-ash">Browse</span>
        <h2 className="mb-10 text-display-md font-medium uppercase tracking-tighter text-ink md:mb-14">Shop by category</h2>
      </Reveal>
      <div className={tiles.length === 1 ? "grid grid-cols-1" : "grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6"}>
        {tiles.map((t, i) => (
          <Reveal key={t.category} delay={i * 0.08}>
            <Link
              href={`/shop?category=${t.key}`}
              data-cursor="Shop"
              className="group relative block aspect-[4/3] overflow-hidden rounded-md bg-sand/40 md:aspect-[16/10]"
            >
              {t.image && (
                <Image
                  src={t.image}
                  alt={t.alt}
                  fill
                  sizes="(min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-700 ease-editorial group-hover:scale-[1.04]"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 md:p-8">
                <div>
                  <p className="font-display text-2xl font-medium uppercase tracking-tighter text-paper md:text-4xl">{t.category}</p>
                  <p className="mt-1 text-xs uppercase tracking-widest2 text-paper/70">
                    {t.count} {t.count === 1 ? "piece" : "pieces"}
                  </p>
                </div>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper text-ink transition-transform duration-300 group-hover:rotate-45">
                  <ArrowUpRight size={18} strokeWidth={1.5} />
                </span>
              </div>
            </Link>
            {/* Straight to a sub-category. */}
            {t.subcategories.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {t.subcategories.map((s) => (
                  <Link
                    key={s.key}
                    href={`/shop?category=${t.key}&sub=${s.key}`}
                    className="rounded-full border border-taupe/50 px-3.5 py-1.5 text-[11px] uppercase tracking-widest2 text-graphite transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            )}
          </Reveal>
        ))}
      </div>
    </section>
  );
}
