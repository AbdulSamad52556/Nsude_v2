"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { CardData } from "@/lib/types";
import { campaignImages } from "@/lib/images";
import { cx } from "@/lib/utils";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProductCard } from "@/components/product/ProductCard";

const fits = [
  {
    key: "Relaxed",
    label: "Relaxed",
    image: campaignImages.fitRelaxed,
    copy: "Easy through the body with room to move. For days that don't need explaining.",
  },
  {
    key: "Regular",
    label: "Regular",
    image: campaignImages.fitRegular,
    copy: "Our baseline silhouette — tailored without trying. Works with everything you own.",
  },
  {
    key: "Oversized",
    label: "Oversized",
    image: campaignImages.fitOversized,
    copy: "Dropped shoulders, generous body. Volume, deliberately drafted.",
  },
] as const;

/** `cardsByFit`: up to three products per fit tab, fetched on the server. */
export function ShopTheFit({ cardsByFit }: { cardsByFit: Record<string, CardData[]> }) {
  const [active, setActive] = useState<(typeof fits)[number]["key"]>("Regular");
  const current = fits.find((f) => f.key === active)!;
  const matches = cardsByFit[active] ?? [];

  return (
    <section className="border-t border-taupe/30 bg-paper px-5 py-24 md:px-10 md:py-36">
      <div>
        <SectionHeading
          eyebrow="Find Your Fit"
          title="Shop The Fit"
          subtitle="Same construction, three different silhouettes. Choose how you want it to sit."
          className="mb-14"
        />

        {/* Pill tabs; the black fill slides to the chosen fit. */}
        <div
          role="tablist"
          aria-label="Select a fit"
          className="mb-10 inline-flex rounded-full border border-taupe/50 p-1"
        >
          {fits.map((fit) => (
            <button
              key={fit.key}
              role="tab"
              aria-selected={active === fit.key}
              onClick={() => setActive(fit.key)}
              className={cx(
                "relative h-9 rounded-full px-5 text-[11px] uppercase tracking-widest2 transition-colors duration-300 md:h-10 md:px-7",
                active === fit.key ? "text-paper" : "text-graphite hover:text-ink"
              )}
            >
              {active === fit.key && (
                <motion.span
                  layoutId="fit-pill"
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-ink"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{fit.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-10">
          <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-bone md:col-span-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                <Image
                  src={current.image}
                  alt={`NSUDE ${current.label} fit, editorial`}
                  fill
                  sizes="(min-width: 768px) 40vw, 100vw"
                  className="object-cover"
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex flex-col justify-center gap-8 md:col-span-7">
            <AnimatePresence mode="wait">
              <motion.p
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="max-w-md text-lg leading-relaxed text-graphite"
              >
                {current.copy}
              </motion.p>
            </AnimatePresence>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {matches.map((card) => (
                <ProductCard key={card.code} card={card} imageSizes="(min-width: 768px) 18vw, 50vw" />
              ))}
            </div>

            <Link
              href={`/shop?fit=${active.toLowerCase()}`}
              className="group inline-flex items-center gap-2 self-start border-b border-ink pb-1 text-xs uppercase tracking-widest2 text-ink"
            >
              Shop all {current.label.toLowerCase()}
              <ArrowRight size={14} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
