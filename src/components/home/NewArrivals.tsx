"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { CardData } from "@/lib/types";
import { cx } from "@/lib/utils";
import { ProductCard } from "@/components/product/ProductCard";
import { Reveal } from "@/components/ui/Reveal";

/**
 * "New In": a row of the newest pieces. Swipe on phones (scroll-snap);
 * arrows on large screens step one screenful at a time.
 */
export function NewArrivals({ cards }: { cards: CardData[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  function update() {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  }
  useEffect(update, [cards.length]);

  function step(dir: 1 | -1) {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  }

  if (cards.length === 0) return null;

  const arrow = "flex h-10 w-10 items-center justify-center rounded-full border border-ink/20 text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-30";

  return (
    <section className="bg-paper py-20 md:py-28">
      <div className="mb-8 flex items-end justify-between gap-6 px-5 md:mb-12 md:px-10">
        <Reveal>
          <span className="mb-3 block text-xs uppercase tracking-widest2 text-ash">Just landed</span>
          <h2 className="text-display-md font-medium uppercase tracking-tighter text-ink">New In</h2>
        </Reveal>
        <div className="flex items-center gap-4">
          <Link
            href="/shop?sort=newest"
            className="text-xs uppercase tracking-widest2 text-ink underline-offset-8 hover:underline"
          >
            Shop all
          </Link>
          <div className="hidden gap-2 md:flex">
            <button type="button" onClick={() => step(-1)} disabled={edges.start} aria-label="Previous" className={arrow}>
              <ArrowLeft size={16} strokeWidth={1.5} />
            </button>
            <button type="button" onClick={() => step(1)} disabled={edges.end} aria-label="Next" className={arrow}>
              <ArrowRight size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={track}
        onScroll={update}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] md:scroll-px-10 md:gap-6 md:px-10 [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card, i) => (
          <div
            key={card.code}
            className={cx(
              "w-[68%] shrink-0 snap-start sm:w-[42%] md:w-[30%] lg:w-[23%] min-[1800px]:w-[18%]",
              i === cards.length - 1 && "mr-1"
            )}
          >
            <ProductCard card={card} imageSizes="(min-width: 1024px) 23vw, (min-width: 768px) 30vw, 68vw" />
          </div>
        ))}
      </div>
    </section>
  );
}
