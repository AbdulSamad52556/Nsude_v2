"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ProductImage } from "@/lib/types";
import { cx } from "@/lib/utils";

/**
 * One large photo at a time with dots underneath. Swipe on every screen:
 * touch and trackpads scroll natively (scroll-snap, so the photo follows the
 * finger); a mouse can drag. Dots and arrow keys jump between photos.
 */
export function ProductGallery({
  images,
  badge,
}: {
  images: ProductImage[];
  /** Corner tag, matching the shop cards. */
  badge?: "new" | "sold-out" | null;
}) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  // Mouse drag: where it started, and whether it moved (to swallow the click).
  const drag = useRef<{ x: number; scrollLeft: number; moved: boolean } | null>(null);

  if (images.length === 0) {
    return <div className="aspect-[4/5] w-full bg-bone" aria-hidden />;
  }

  const count = images.length;

  function goTo(index: number) {
    const track = trackRef.current;
    if (!track) return;
    const i = (index + count) % count;
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  }

  // The visible photo follows the scroll position (swipes, arrows, dots).
  function onScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== active) setActive(Math.min(count - 1, Math.max(0, i)));
  }

  // Mouse "swipe": drag the photos, then snap to the next / previous one
  // (touch and trackpads already swipe through native scrolling).
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (e.pointerType !== "mouse" || e.button !== 0 || !track || count < 2) return;
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
    const to = dx < -50 ? from + 1 : dx > 50 ? from - 1 : from;
    const i = Math.min(count - 1, Math.max(0, to));
    track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
    window.setTimeout(() => {
      track.style.scrollSnapType = "";
    }, 400);
    window.setTimeout(() => {
      drag.current = null;
    }, 0);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") goTo(active + 1);
    if (e.key === "ArrowLeft") goTo(active - 1);
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
          data-cursor={count > 1 ? "Drag" : undefined}
          className={cx(
            "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-bone [scrollbar-width:none] focus:outline-none [&::-webkit-scrollbar]:hidden",
            count > 1 && "cursor-grab select-none active:cursor-grabbing"
          )}
        >
          {images.map((img, i) => (
            <div
              key={img.src + i}
              className="relative aspect-[4/5] w-full shrink-0 snap-center snap-always"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== active || undefined}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                priority={i === 0}
                draggable={false}
                sizes="(min-width: 768px) 55vw, 100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {badge === "sold-out" ? (
          <span className="pointer-events-none absolute left-4 top-4 bg-paper px-2.5 py-1 text-[10px] uppercase tracking-widest2 text-ink">
            Sold Out
          </span>
        ) : (
          badge === "new" && (
            <span className="pointer-events-none absolute left-4 top-4 bg-moss px-2.5 py-1 text-[10px] uppercase tracking-widest2 text-paper">
              New
            </span>
          )
        )}
      </div>

      {/* Dots: which photo is showing; tap one to jump to it. */}
      {count > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {images.map((img, i) => (
            <button
              key={img.src + i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={active === i || undefined}
              className="flex h-4 w-3 items-center justify-center"
            >
              <span
                className={cx(
                  "block h-1.5 w-1.5 rounded-full transition-colors",
                  active === i ? "bg-ink" : "bg-graphite/25"
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
