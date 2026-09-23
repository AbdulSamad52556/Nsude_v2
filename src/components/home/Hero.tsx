"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  MotionValue,
} from "framer-motion";
import { ArrowRight } from "lucide-react";
import { products } from "@/lib/products";
import { formatPrice, cx } from "@/lib/utils";
import { MagneticButton } from "@/components/ui/MagneticButton";

const ease = [0.16, 1, 0.3, 1] as const;

const heroSlugs = ["core-tee", "heavy-tee", "signature-tee", "oversized-tee", "archive-tee"];

const heroCutouts = [
  { src: "/tshirts/tee-1.png", width: 433, height: 576 },
  { src: "/tshirts/tee-2.png", width: 433, height: 576 },
  { src: "/tshirts/tee-3.png", width: 433, height: 576 },
  { src: "/tshirts/tee-4.png", width: 433, height: 576 },
  { src: "/tshirts/tee-5.png", width: 433, height: 577 },
];

const heroProducts = heroSlugs
  .map((slug) => products.find((p) => p.slug === slug))
  .filter((p): p is (typeof products)[number] => Boolean(p))
  .map((product, i) => ({ ...product, cutout: heroCutouts[i] }));

// Scroll budget: an initial "clear the stage" phase (fade out copy, zoom the
// shirt in) followed by PER_TEE_VH of scroll per t-shirt in the carousel.
const INTRO_VH = 130;
const PER_TEE_VH = 100;
const CYCLE_VH = heroProducts.length * PER_TEE_VH;
const TOTAL_VH = INTRO_VH + CYCLE_VH;
const INTRO_END = INTRO_VH / TOTAL_VH;
// How long scrolling must be idle before the carousel snaps to a tee.
const SNAP_IDLE_MS = 120;
// Touch scrolls end in momentum, and iOS Safari can report it in sparse,
// uneven scroll events — so wait longer after touch input before snapping.
const TOUCH_SNAP_IDLE_MS = 260;
// Fraction of a tee's scroll distance that counts as intent to move on —
// small enough that a single mouse-wheel notch advances to the next tee.
const SNAP_INTENT = 0.04;

interface HeroCopyProps {
  index: number;
  opacity: MotionValue<number>;
  y: MotionValue<number>;
}

function HeroCopy({ index, opacity, y }: HeroCopyProps) {
  const active = heroProducts[index];
  // The copy layer sits above the tee stage and spans the full hero, so it
  // must let clicks fall through to the tees (each links to its product).
  // Only the CTA takes clicks, and only while it's actually visible.
  const ctaPointerEvents = useTransform(opacity, (o) => (o > 0.05 ? "auto" : "none"));
  return (
    <div className="pointer-events-none relative z-10 mx-auto flex h-full w-full max-w-content flex-col justify-end px-5 pb-14 md:px-10 md:pb-20">
      <motion.div style={{ opacity, y }}>
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.7, ease }}
          className="mb-5 block text-xs uppercase tracking-widest2 text-bone/80"
        >
          NSUDE / 0{index + 1}
        </motion.span>

        <h1 className="overflow-hidden">
          <motion.span
            initial={{ y: "110%" }}
            animate={{ y: "0%" }}
            transition={{ delay: 0.85, duration: 1, ease }}
            className="block text-display-xl font-medium uppercase text-bone"
          >
            Essentials,
          </motion.span>
        </h1>
        <h1 className="overflow-hidden">
          <motion.span
            initial={{ y: "110%" }}
            animate={{ y: "0%" }}
            transition={{ delay: 0.98, duration: 1, ease }}
            className="block text-display-xl font-medium uppercase text-bone"
          >
            Redefined.
          </motion.span>
        </h1>
      </motion.div>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-8">
        <motion.div style={{ opacity, y, pointerEvents: ctaPointerEvents }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.7, ease }}
          >
            <MagneticButton>
              <Link
                href="/shop"
                className="group inline-flex items-center gap-3 border-b border-bone pb-1 text-sm uppercase tracking-widest2 text-bone"
              >
                Shop T-Shirts
                <ArrowRight
                  size={16}
                  strokeWidth={1.5}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
            </MagneticButton>
          </motion.div>
        </motion.div>

        {/* Name/price stays visible and keeps updating throughout scroll,
            unlike the rest of the hero copy which hides once cycling starts. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease }}
            className="text-right"
          >
            <p className="text-sm uppercase tracking-wide text-bone">{active.name}</p>
            <p className="mt-1 text-xs text-bone/70">{formatPrice(active.price)}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

interface TeeItemProps {
  p: MotionValue<number>;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  gate: MotionValue<number>;
  cutout: { src: string; width: number; height: number };
  name: string;
  slug: string;
  mobile: boolean;
}

// Horizontal offsets for the "up next" preview and the fully-faded far slot.
// Desktop tees are small relative to viewport width, so vw spacing works.
// On mobile the tee is ~32vh wide (42vh tall), which on a tall phone is most
// of the screen width — vw offsets would stack neighbors on top of the
// centered tee. Offsets in vh scale with the tee itself: 28vh clears the
// full-size tee's half-width (~16vh) plus a half-scale neighbor (~8vh) with
// a visible gap, and that gap holds through the whole transition since both
// position and scale interpolate linearly.
const SLOT_OFFSETS = {
  desktop: { near: "32vw", far: "70vw" },
  mobile: { near: "28vh", far: "64vh" },
};

/**
 * Position/opacity/scale are derived directly from scroll position (not from
 * discrete state), so the transition tracks the scrollbar with zero lag.
 * This is a coverflow: the item due up next sits small on the right and
 * continuously grows into the centered, full-size "current" position as
 * scroll approaches its index, then keeps shrinking down to a small preview
 * on the left as scroll moves past it into the following item. The last
 * item has no successor, so it simply holds centered at full size through
 * the end of the section instead of shrinking away.
 *
 * `gate` suppresses every neighbor preview until scroll actually moves past
 * the intro (clear + zoom) phase — otherwise the second tee's "up next"
 * preview would already be sitting on screen while the intro is still
 * playing, since scroll position stays pinned at 0 for that whole phase.
 * The first item is exempt: it's the one thing that should already be
 * fully visible before the user has scrolled at all.
 */
function TeeItem({ p, index, isFirst, isLast, gate, cutout, name, slug, mobile }: TeeItemProps) {
  const { near, far } = SLOT_OFFSETS[mobile ? "mobile" : "desktop"];
  const zero = mobile ? "0vh" : "0vw";
  const points = isLast
    ? [index - 1.4, index - 1, index]
    : [index - 1.4, index - 1, index, index + 1, index + 1.4];
  const xOutput = isLast
    ? [far, near, zero]
    : [far, near, zero, `-${near}`, `-${far}`];
  const scaleOutput = isLast ? [0.3, 0.5, 1] : [0.3, 0.5, 1, 0.5, 0.3];
  const opacityOutput = isLast ? [0, 0.65, 1] : [0, 0.65, 1, 0.65, 0];

  const x = useTransform(p, points, xOutput);
  const scale = useTransform(p, points, scaleOutput);
  const rawOpacity = useTransform(p, points, opacityOutput);
  const gatedOpacity = useTransform([rawOpacity, gate], (values) => {
    const [o, g] = values as number[];
    return o * g;
  });
  const opacity = isFirst ? rawOpacity : gatedOpacity;
  // Nearly-invisible neighbor previews shouldn't be clickable — otherwise a
  // faded-out tee sitting off to the side would silently eat clicks meant
  // for whatever's behind it.
  const pointerEvents = useTransform(opacity, (o) => (o > 0.05 ? "auto" : "none"));

  return (
    // will-change keeps each tee on its own GPU layer, rasterized once, so
    // Safari scales the cached bitmap instead of re-painting the image and
    // its drop-shadow filter on every scroll frame.
    <motion.div className="absolute will-change-transform" style={{ x, opacity, scale, pointerEvents }}>
      <motion.div
        animate={{ y: [0, -16, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Link href={`/product/${slug}`} aria-label={`View ${name}`} data-cursor="View" className="block">
          <Image
            src={cutout.src}
            alt={`${name} product shot`}
            width={cutout.width}
            height={cutout.height}
            priority
            className="h-[42vh] w-auto object-contain drop-shadow-2xl md:h-[58vh]"
          />
        </Link>
      </motion.div>
    </motion.div>
  );
}

interface TeeStageProps {
  p: MotionValue<number>;
  zoom: MotionValue<number>;
  gate: MotionValue<number>;
  mobile: boolean;
}

function TeeStage({ p, zoom, gate, mobile }: TeeStageProps) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden pb-16 will-change-transform"
      style={{ scale: zoom }}
    >
      <div
        aria-hidden
        className="absolute h-[46vh] w-[46vh] rounded-full bg-graphite/40 blur-[110px] md:h-[54vh] md:w-[54vh]"
      />
      {heroProducts.map((product, i) => (
        <TeeItem
          key={product.id}
          p={p}
          index={i}
          isFirst={i === 0}
          isLast={i === heroProducts.length - 1}
          gate={gate}
          cutout={product.cutout}
          name={product.name}
          slug={product.slug}
          mobile={mobile}
        />
      ))}
    </motion.div>
  );
}

// Matches Tailwind's `md` breakpoint, where the tee switches to its desktop size.
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

function StaticHero() {
  const first = heroProducts[0];
  const fullOpacity = useMotionValue(1);
  const noOffset = useMotionValue(0);

  return (
    <section id="home-hero" className="relative flex h-[100svh] min-h-[560px] w-full items-end overflow-hidden bg-ink">
      <div className="absolute inset-0 flex items-center justify-center pb-16">
        <Link
          href={`/product/${first.slug}`}
          aria-label={`View ${first.name}`}
          data-cursor="View"
          className="block"
        >
          <Image
            src={first.cutout.src}
            alt={`${first.name} product shot`}
            width={first.cutout.width}
            height={first.cutout.height}
            priority
            className="h-[42vh] w-auto object-contain drop-shadow-2xl md:h-[58vh]"
          />
        </Link>
      </div>
      <HeroCopy index={0} opacity={fullOpacity} y={noOffset} />
    </section>
  );
}

export function Hero() {
  const shouldReduceMotion = useReducedMotion();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isMobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end end"],
  });

  // Raw scroll events (especially mouse-wheel, as opposed to trackpad) tend
  // to arrive in coarse steps. Smoothing the signal through a spring before
  // deriving anything from it turns those steps into a fluid glide, which
  // is where the actual "smoothness" of the whole sequence comes from.
  const smoothScrollYProgress = useSpring(scrollYProgress, {
    stiffness: 280,
    damping: 40,
    mass: 0.4,
  });

  // Phase 1 (0 -> INTRO_END): fade out headline/CTA/labels and zoom the
  // shirt in. Phase 2 (INTRO_END -> 1): the rotation carousel through all
  // five tees. `p` stays clamped at 0 until the intro finishes.
  const chromeOpacity = useTransform(smoothScrollYProgress, [0, INTRO_END], [1, 0]);
  const chromeY = useTransform(smoothScrollYProgress, [0, INTRO_END], [0, -18]);
  const teeZoom = useTransform(smoothScrollYProgress, [0, INTRO_END], [1, 1.35]);
  const p = useTransform(smoothScrollYProgress, [INTRO_END, 1], [0, heroProducts.length]);
  // Sharp on/off switch for neighbor previews: 0 for the entire intro phase
  // (where scroll position is pinned), 1 the instant real cycling begins.
  const previewGate = useTransform(
    smoothScrollYProgress,
    [INTRO_END - 0.001, INTRO_END],
    [0, 1]
  );

  useMotionValueEvent(p, "change", (v) => {
    const idx = Math.min(heroProducts.length - 1, Math.max(0, Math.round(v)));
    setActiveIndex((prev) => (prev === idx ? prev : idx));
  });

  // "Gravity" snap: once scrolling settles inside the carousel phase, glide
  // to a tee so the stage never rests between two shirts. The snap follows
  // scroll direction relative to the tee we last rested on (`anchor`), so
  // even a single wheel notch pulls the next tee in instead of springing
  // back. Reads the raw scroll position (not the spring) so the target is
  // exact. Skipped while a finger is on the screen so it never fights a drag.
  useEffect(() => {
    if (shouldReduceMotion) return;

    const last = heroProducts.length - 1;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let touching = false;
    let anchor = 0;

    function snap() {
      const el = wrapperRef.current;
      if (!el || touching) return;

      const top = el.getBoundingClientRect().top + window.scrollY;
      const range = el.offsetHeight - window.innerHeight;
      if (range <= 0) return;

      const progress = (window.scrollY - top) / range;
      // Intro phase and the space past the section scroll freely.
      if (progress <= INTRO_END) {
        anchor = 0;
        return;
      }
      if (progress >= 1) {
        anchor = last;
        return;
      }

      const raw = ((progress - INTRO_END) / (1 - INTRO_END)) * heroProducts.length;
      // The last tee holds centered until the section ends — nothing to snap to.
      if (raw >= last) {
        anchor = last;
        return;
      }

      const nearest = Math.round(raw);
      if (Math.abs(raw - nearest) < 0.01) {
        anchor = nearest;
        return;
      }

      const delta = raw - anchor;
      let target = anchor;
      if (delta > SNAP_INTENT) target = Math.ceil(raw);
      else if (delta < -SNAP_INTENT) target = Math.floor(raw);
      target = Math.min(last, Math.max(0, target));

      anchor = target;
      const targetProgress = INTRO_END + (target / heroProducts.length) * (1 - INTRO_END);
      window.scrollTo({ top: top + targetProgress * range, behavior: "smooth" });
    }

    // A quiet gap in scroll events doesn't prove the page has stopped: iOS
    // momentum can go quiet mid-glide, and a smooth scrollTo then cancels
    // the momentum and fights it (the "hang"). So confirm the position is
    // unchanged across two frames before snapping; if it's still moving,
    // wait for the next idle window instead.
    function settleThenSnap() {
      const y = window.scrollY;
      settleFrame = requestAnimationFrame(() => {
        settleFrame = requestAnimationFrame(() => {
          if (window.scrollY !== y) schedule();
          else snap();
        });
      });
    }

    let lastInputTouch = false;
    let settleFrame = 0;
    function schedule() {
      clearTimeout(idleTimer);
      cancelAnimationFrame(settleFrame);
      idleTimer = setTimeout(settleThenSnap, lastInputTouch ? TOUCH_SNAP_IDLE_MS : SNAP_IDLE_MS);
    }
    function onScroll() {
      schedule();
    }
    function onWheel() {
      lastInputTouch = false;
    }
    function onTouchStart() {
      touching = true;
      lastInputTouch = true;
      clearTimeout(idleTimer);
      cancelAnimationFrame(settleFrame);
    }
    function onTouchEnd() {
      touching = false;
      schedule();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      clearTimeout(idleTimer);
      cancelAnimationFrame(settleFrame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [shouldReduceMotion]);

  if (shouldReduceMotion) {
    return <StaticHero />;
  }

  return (
    <section
      id="home-hero"
      ref={wrapperRef}
      className="relative bg-ink"
      style={{ height: `${TOTAL_VH}vh` }}
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        {/* Keyed so the per-tee transforms rebuild with the right offsets
            when crossing the mobile breakpoint. */}
        <TeeStage key={isMobile ? "m" : "d"} p={p} zoom={teeZoom} gate={previewGate} mobile={isMobile} />

        <HeroCopy index={activeIndex} opacity={chromeOpacity} y={chromeY} />

        <motion.div
          style={{ opacity: chromeOpacity }}
          className="pointer-events-none absolute right-5 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-3 md:right-10 md:flex"
          aria-hidden
        >
          {heroProducts.map((product, i) => (
            <span
              key={product.id}
              className={cx(
                "h-6 w-px transition-colors duration-500",
                i === activeIndex ? "bg-bone" : "bg-bone/25"
              )}
            />
          ))}
        </motion.div>

        <motion.div
          style={{ opacity: chromeOpacity }}
          className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-[10px] uppercase tracking-widest2 text-bone/60"
          aria-hidden
        >
          Scroll
          <motion.span
            className="h-8 w-px bg-bone/40"
            animate={{ scaleY: [0.4, 1, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </section>
  );
}
