"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ProductImage } from "@/lib/types";
import { cx } from "@/lib/utils";

// Layout effect in the browser (runs before paint, so the jump to the first
// photo is never seen); plain effect on the server, where it can't run.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type GalleryProps = {
  images: ProductImage[];
  /** Corner tag, matching the shop cards. */
  badge?: "new" | "sold-out" | null;
};

/** Phones: swipe through the photos. Large screens: thumbnails + one big photo. */
export function ProductGallery(props: GalleryProps) {
  return (
    <>
      <div className="md:hidden">
        <SwipeGallery {...props} />
      </div>
      <div className="hidden md:block">
        <ThumbnailGallery {...props} />
      </div>
    </>
  );
}

function Badge({ badge }: { badge: GalleryProps["badge"] }) {
  if (badge === "sold-out") {
    return (
      <span className="pointer-events-none absolute left-4 top-4 z-10 bg-paper px-2.5 py-1 text-[10px] uppercase tracking-widest2 text-ink">
        Sold Out
      </span>
    );
  }
  if (badge === "new") {
    return (
      <span className="pointer-events-none absolute left-4 top-4 z-10 bg-ink px-2.5 py-1 text-[10px] uppercase tracking-widest2 text-paper">
        New
      </span>
    );
  }
  return null;
}

/**
 * Large screens (no swiping with a mouse): a column of thumbnails beside one
 * big photo, which fades to the one clicked. Arrow keys step through them.
 */
function ThumbnailGallery({ images, badge }: GalleryProps) {
  const [active, setActive] = useState(0);
  const count = images.length;
  if (count === 0) return <div className="aspect-[4/5] w-full bg-bone" aria-hidden />;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") setActive((i) => (i + 1) % count);
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") setActive((i) => (i - 1 + count) % count);
  }

  return (
    // Its column (ProductView) caps the width so the photo fits the screen height.
    <div className="flex gap-4">
      {count > 1 && (
        <div className="flex w-20 shrink-0 flex-col gap-3">
          {images.map((img, i) => (
            <button
              key={img.src + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={active === i || undefined}
              className={cx(
                "relative aspect-[4/5] w-full overflow-hidden border transition-[opacity,border-color]",
                active === i ? "border-ink" : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              <Image src={img.src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <div
        className="relative aspect-[4/5] w-full flex-1 overflow-hidden bg-bone focus:outline-none"
        tabIndex={0}
        role="group"
        aria-label="Product image gallery"
        aria-roledescription="carousel"
        onKeyDown={onKeyDown}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            <Image
              src={images[active].src}
              alt={images[active].alt}
              fill
              priority={active === 0}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>
        <Badge badge={badge} />
        {count > 1 && (
          <div className="absolute bottom-4 right-4 bg-ink/80 px-2 py-1 text-[11px] tracking-wide text-paper">
            {active + 1} / {count}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Phones: one large photo at a time with dots underneath. Touch scrolls
 * natively (scroll-snap, so the photo follows the finger); a mouse can drag.
 * Dots and arrow keys jump between photos.
 *
 * It loops: a copy of the last photo sits before the first and a copy of
 * the first after the last. Landing on a copy silently jumps to the real
 * photo, so swiping past the end carries on to the start (and vice versa).
 */
function SwipeGallery({ images, badge }: GalleryProps) {
  const count = images.length;
  // The loop copies are added only in the browser, so the server-rendered
  // page (and the moment before scripts run) shows the first photo.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const loops = count > 1 && ready;
  // Track slides: [last copy, ...photos, first copy] when looping.
  const slides = loops ? [images[count - 1], ...images, images[0]] : images;
  const offset = loops ? 1 : 0; // track position of photo 0

  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  // Mouse drag: where it started, and whether it moved (to swallow the click).
  const drag = useRef<{ x: number; scrollLeft: number; moved: boolean } | null>(null);
  const settleTimer = useRef<number>();

  const width = () => trackRef.current?.clientWidth || 1;

  /** Instantly show a track position (no animation). */
  const jumpTo = useCallback((position: number) => {
    const track = trackRef.current;
    if (track) track.scrollLeft = position * track.clientWidth;
  }, []);

  // Start on the real first photo, and stay on the same photo when the
  // gallery is resized (e.g. rotating a phone).
  const activeRef = useRef(0);
  activeRef.current = active;
  useIsomorphicLayoutEffect(() => {
    jumpTo(offset);
  }, [jumpTo, offset]);
  useEffect(() => {
    const onResize = () => jumpTo(activeRef.current + offset);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [jumpTo, offset]);

  /** After scrolling stops on a copy, jump to the real photo it shows. */
  const settle = useCallback(() => {
    const track = trackRef.current;
    if (!track || !loops || drag.current) return;
    const position = Math.round(track.scrollLeft / track.clientWidth);
    if (position === 0) jumpTo(count);
    else if (position === count + 1) jumpTo(1);
  }, [count, jumpTo, loops]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !loops) return;
    // `scrollend` where supported; the debounced check in onScroll covers
    // browsers without it.
    track.addEventListener("scrollend", settle);
    return () => track.removeEventListener("scrollend", settle);
  }, [loops, settle]);

  if (count === 0) {
    return <div className="aspect-[4/5] w-full bg-bone" aria-hidden />;
  }

  /** Scroll smoothly to a track position (may be a copy; settle fixes it). */
  function scrollToPosition(position: number) {
    trackRef.current?.scrollTo({ left: position * width(), behavior: "smooth" });
  }

  // The visible photo follows the scroll position (swipes, keys, dots).
  function onScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const position = Math.round(track.scrollLeft / track.clientWidth);
    const index = (((position - offset) % count) + count) % count;
    if (index !== active) setActive(index);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, 150);
  }

  // Mouse "swipe": drag the photos, then snap to the next / previous one
  // (touch and trackpads already swipe through native scrolling).
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (e.pointerType !== "mouse" || e.button !== 0 || !track || !loops) return;
    drag.current = { x: e.clientX, scrollLeft: track.scrollLeft, moved: false };
    track.setPointerCapture(e.pointerId);
    track.style.scrollSnapType = "none"; // follow the mouse freely while dragging
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!drag.current || !track) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    track.scrollLeft = drag.current.scrollLeft - dx;
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    const start = drag.current;
    if (!start || !track) return;
    const dx = e.clientX - start.x;
    const from = Math.round(start.scrollLeft / track.clientWidth);
    // A short flick is enough to change photo; otherwise settle back.
    const to = Math.min(slides.length - 1, Math.max(0, dx < -50 ? from + 1 : dx > 50 ? from - 1 : from));
    scrollToPosition(to);
    window.setTimeout(() => {
      track.style.scrollSnapType = "";
    }, 400);
    window.setTimeout(() => {
      drag.current = null;
    }, 0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") scrollToPosition(active + offset + 1);
    if (e.key === "ArrowLeft") scrollToPosition(active + offset - 1);
  }

  return (
    <div>
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          // A drag shouldn't count as a click on the photo.
          onClickCapture={(e) => drag.current?.moved && e.stopPropagation()}
          tabIndex={0}
          role="group"
          aria-label="Product image gallery"
          aria-roledescription="carousel"
          data-cursor={loops ? "Drag" : undefined}
          className={cx(
            "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-bone [scrollbar-width:none] focus:outline-none [&::-webkit-scrollbar]:hidden",
            loops && "cursor-grab select-none active:cursor-grabbing"
          )}
        >
          {slides.map((img, position) => {
            const isCopy = loops && (position === 0 || position === slides.length - 1);
            const index = position - offset;
            return (
              <div
                key={isCopy ? `copy-${position}` : img.src + index}
                className="relative aspect-[4/5] w-full shrink-0 snap-center snap-always"
                aria-roledescription={isCopy ? undefined : "slide"}
                aria-label={isCopy ? undefined : `${index + 1} of ${count}`}
                aria-hidden={isCopy || index !== active || undefined}
              >
                <Image
                  src={img.src}
                  alt={isCopy ? "" : img.alt}
                  fill
                  priority={!isCopy && index === 0}
                  draggable={false}
                  sizes="(min-width: 768px) 55vw, 100vw"
                  className="object-cover"
                />
              </div>
            );
          })}
        </div>

        <Badge badge={badge} />
      </div>

      {/* Dots: which photo is showing; tap one to jump to it. */}
      {count > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {images.map((img, i) => (
            <button
              key={img.src + i}
              type="button"
              onClick={() => scrollToPosition(i + offset)}
              aria-label={`View image ${i + 1}`}
              aria-current={active === i || undefined}
              className="flex h-4 w-3 items-center justify-center"
            >
              <span
                className={cx(
                  "block h-1.5 w-1.5 rounded-full transition-colors",
                  active === i ? "bg-ink" : "bg-ash/25"
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
