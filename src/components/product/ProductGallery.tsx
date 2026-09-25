"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { ProductImage } from "@/lib/types";
import { cx } from "@/lib/utils";

export function ProductGallery({ images }: { images: ProductImage[] }) {
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);

  if (images.length === 0) {
    return <div className="aspect-[4/5] w-full bg-bone" aria-hidden />;
  }

  function next() {
    setActive((i) => (i + 1) % images.length);
  }
  function prev() {
    setActive((i) => (i - 1 + images.length) % images.length);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  }

  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchX.current;
    if (delta > 50) prev();
    if (delta < -50) next();
    touchX.current = null;
  }

  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row md:gap-4">
      <div className="flex shrink-0 gap-3 overflow-x-auto md:w-20 md:flex-col md:overflow-visible">
        {images.map((img, i) => (
          <button
            key={img.src + i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`View image ${i + 1}`}
            aria-current={active === i}
            className={cx(
              "relative aspect-[4/5] w-16 shrink-0 overflow-hidden border transition-colors md:w-full",
              active === i ? "border-ink" : "border-transparent opacity-60 hover:opacity-100"
            )}
          >
            <Image src={img.src} alt="" fill sizes="80px" className="object-cover" />
          </button>
        ))}
      </div>

      <div
        className="relative aspect-[4/5] w-full flex-1 overflow-hidden bg-bone focus:outline-none"
        tabIndex={0}
        role="group"
        aria-label="Product image gallery"
        aria-roledescription="carousel"
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-cursor="Zoom"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            <Image
              src={images[active].src}
              alt={images[active].alt}
              fill
              priority
              sizes="(min-width: 768px) 55vw, 100vw"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>

        <div className="absolute bottom-4 right-4 bg-ink/80 px-2 py-1 text-[11px] tracking-wide text-bone">
          {active + 1} / {images.length}
        </div>
      </div>
    </div>
  );
}
