"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { products } from "@/lib/products";
import { campaignImages } from "@/lib/images";
import { formatPrice } from "@/lib/utils";
import { SectionHeading } from "@/components/ui/SectionHeading";

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

export function ShopTheFit() {
  const [active, setActive] = useState<(typeof fits)[number]["key"]>("Regular");
  const current = fits.find((f) => f.key === active)!;
  const matches = products.filter((p) => p.fit === active).slice(0, 3);

  return (
    <section className="bg-paper px-5 py-28 md:px-10 md:py-36">
      <div className="mx-auto max-w-content">
        <SectionHeading
          eyebrow="Find Your Fit"
          title="Shop The Fit"
          subtitle="Same construction, three different silhouettes. Choose how you want it to sit."
          className="mb-14"
        />

        <div
          role="tablist"
          aria-label="Select a fit"
          className="mb-10 flex gap-8 border-b border-graphite/15"
        >
          {fits.map((fit) => (
            <button
              key={fit.key}
              role="tab"
              aria-selected={active === fit.key}
              onClick={() => setActive(fit.key)}
              className={`relative pb-4 text-xs uppercase tracking-widest2 transition-colors ${
                active === fit.key ? "text-ink" : "text-ash hover:text-graphite"
              }`}
            >
              {fit.label}
              {active === fit.key && (
                <motion.span
                  layoutId="fit-underline"
                  className="absolute -bottom-px left-0 h-px w-full bg-ink"
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-10">
          <div className="relative aspect-[4/5] overflow-hidden bg-bone md:col-span-5">
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {matches.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.slug}`}
                  data-cursor="View"
                  className="group flex flex-col gap-3"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-bone">
                    <Image
                      src={product.images[0].src}
                      alt={product.images[0].alt}
                      fill
                      sizes="200px"
                      className="object-cover transition-transform duration-700 ease-editorial group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-ink">
                      {product.name}
                    </span>
                    <ArrowUpRight
                      size={14}
                      strokeWidth={1.5}
                      className="text-ash transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </div>
                  <span className="text-xs text-ash">{formatPrice(product.price)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
