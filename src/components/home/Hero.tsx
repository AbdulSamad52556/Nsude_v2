"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
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
// shirt in) followed by one full screen-height per t-shirt in the carousel.
const INTRO_VH = 130;
const CYCLE_VH = heroProducts.length * 100;
const TOTAL_VH = INTRO_VH + CYCLE_VH;
const INTRO_END = INTRO_VH / TOTAL_VH;

interface HeroCopyProps {
  index: number;
  opacity: MotionValue<number>;
  y: MotionValue<number>;
}

function HeroCopy({ index, opacity, y }: HeroCopyProps) {
  const active = heroProducts[index];
  return (
    <div className="relative z-10 mx-auto flex h-full w-full max-w-content flex-col justify-end px-5 pb-14 md:px-10 md:pb-20">
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
        <motion.div style={{ opacity, y }}>
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
}

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
function TeeItem({ p, index, isFirst, isLast, gate, cutout, name, slug }: TeeItemProps) {
  const points = isLast
    ? [index - 1.4, index - 1, index]
    : [index - 1.4, index - 1, index, index + 1, index + 1.4];
  const xOutput = isLast
    ? ["70vw", "32vw", "0vw"]
    : ["70vw", "32vw", "0vw", "-32vw", "-70vw"];
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
    <motion.div className="absolute" style={{ x, opacity, scale, pointerEvents }}>
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
}

function TeeStage({ p, zoom, gate }: TeeStageProps) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden pb-16"
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
        />
      ))}
    </motion.div>
  );
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
        <TeeStage p={p} zoom={teeZoom} gate={previewGate} />

        <HeroCopy index={activeIndex} opacity={chromeOpacity} y={chromeY} />

        <motion.div
          style={{ opacity: chromeOpacity }}
          className="absolute right-5 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-3 md:right-10 md:flex"
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
          className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-[10px] uppercase tracking-widest2 text-bone/60"
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
