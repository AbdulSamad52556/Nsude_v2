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
import type { HeroSlide } from "@/lib/types";
import { formatPriceRange } from "@/lib/utils";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { useUI } from "@/context/UIContext";

const ease = [0.16, 1, 0.3, 1] as const;

// Scroll budget: an initial "clear the stage" phase (fade out copy, zoom the
// shirt in) followed by PER_TEE_VH of scroll per t-shirt in the carousel.
// The slides themselves come from the database (managed at /admin/hero).
const INTRO_VH = 130;
const PER_TEE_VH = 100;
// How long scrolling must be idle before the carousel snaps to a tee.
const SNAP_IDLE_MS = 120;
// Touch scrolls end in momentum, and iOS Safari can report it in sparse,
// uneven scroll events — so wait longer after touch input before snapping.
const TOUCH_SNAP_IDLE_MS = 260;

interface HeroCopyProps {
  /** Product of the tee currently centered, or null if there are no slides. */
  active: HeroSlide["product"] | null;
  opacity: MotionValue<number>;
  y: MotionValue<number>;
}

const HEADLINE_LINES = ["Essentials,", "Redefined."];
const HEADLINE_DESCRIPTION =
  "Premium men's T-shirts in heavyweight cotton — considered fits, made to be worn for years, not seasons.";

// Headline entrance: each line's letters rise out of a clipping mask one
// after another, tilting upright as they land. Line two follows shortly
// after line one; the description, CTA and product label then fade up.
const lineVariants = {
  hidden: {},
  shown: (line: number) => ({
    transition: { staggerChildren: 0.035, delayChildren: line * 0.22 },
  }),
};
const charVariants = {
  hidden: { y: "115%", rotate: 10, opacity: 0 },
  shown: { y: "0%", rotate: 0, opacity: 1, transition: { duration: 0.9, ease } },
};
const fadeUpVariants = {
  hidden: { opacity: 0, y: 16 },
  shown: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay, duration: 0.8, ease },
  }),
};

function HeroCopy({ active, opacity, y }: HeroCopyProps) {
  const { introReady } = useUI();
  const shouldReduceMotion = useReducedMotion();
  // Entrance animations wait for the preloader to lift (on a client-side
  // visit to home it already has, so they play straight away). Under
  // reduced motion everything simply renders in place.
  const initial = shouldReduceMotion ? false : "hidden";
  const play = shouldReduceMotion || introReady ? "shown" : "hidden";
  // The copy layer sits above the tee stage and spans the full hero, so it
  // must let clicks fall through to the tees (each links to its product).
  // Only the CTA takes clicks, and only while it's actually visible.
  const ctaPointerEvents = useTransform(opacity, (o) => (o > 0.05 ? "auto" : "none"));
  return (
    <div className="pointer-events-none relative z-10 mx-auto flex h-full w-full max-w-content flex-col justify-end px-5 pb-14 md:px-10 md:pb-20">
      <motion.div style={{ opacity, y }}>
        <h1 aria-label={HEADLINE_LINES.join(" ")}>
          {HEADLINE_LINES.map((line, li) => (
            // Slight bottom padding (pulled back with negative margin) so the
            // mask doesn't shave the comma/period while the letters settle.
            <span key={line} aria-hidden className="-mb-[0.08em] block overflow-hidden pb-[0.08em]">
              <motion.span
                custom={li}
                variants={lineVariants}
                initial={initial}
                animate={play}
                // nowrap: each letter is its own inline-block, and the browser
                // may otherwise break between any two of them (e.g. before ",").
                // Below md the size tracks viewport width so "ESSENTIALS," always
                // fits (display-xl's 56px floor overflows phones ≤375px wide).
                className="block whitespace-nowrap text-[min(13.5vw,4.5rem)] font-medium uppercase leading-[0.92] tracking-[-0.03em] text-bone md:text-display-xl"
              >
                {Array.from(line).map((char, ci) => (
                  <motion.span
                    key={ci}
                    variants={charVariants}
                    className="inline-block origin-bottom-left"
                  >
                    {char === " " ? " " : char}
                  </motion.span>
                ))}
              </motion.span>
            </span>
          ))}
        </h1>
        <motion.p
          custom={0.75}
          variants={fadeUpVariants}
          initial={initial}
          animate={play}
          className="mt-4 max-w-[34ch] text-[13px] leading-relaxed text-bone/70 md:mt-6 md:max-w-md md:text-base"
        >
          {HEADLINE_DESCRIPTION}
        </motion.p>
      </motion.div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-8 md:mt-10">
        <motion.div style={{ opacity, y, pointerEvents: ctaPointerEvents }}>
          <motion.div
            custom={1}
            variants={fadeUpVariants}
            initial={initial}
            animate={play}
          >
            <MagneticButton>
              <Link
                href="/shop"
                // Smaller on mobile so the CTA, the centered scroll hint and
                // the product name all fit on one bottom row.
                className="group inline-flex items-center gap-2 border-b border-bone pb-1 text-[11px] uppercase tracking-[0.2em] text-bone md:gap-3 md:text-sm md:tracking-widest2"
              >
                Shop T-Shirts
                <ArrowRight
                  strokeWidth={1.5}
                  className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1 md:h-4 md:w-4"
                />
              </Link>
            </MagneticButton>
          </motion.div>
        </motion.div>

        {/* Name/price stays visible and keeps updating throughout scroll,
            unlike the rest of the hero copy which hides once cycling starts. */}
        {active && (
        <motion.div custom={1.1} variants={fadeUpVariants} initial={initial} animate={play}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease }}
              className="text-right"
            >
              <p className="text-[11px] uppercase tracking-wide text-bone md:text-sm">{active.name}</p>
              <p className="mt-1 text-[10px] text-bone/70 md:text-xs">{formatPriceRange(active.priceRange)}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
        )}
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
  code: string;
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
function TeeItem({ p, index, isFirst, isLast, gate, cutout, name, code, mobile }: TeeItemProps) {
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
        <Link href={`/product/${code}`} aria-label={`View ${name}`} data-cursor="View" className="block">
          <Image
            src={cutout.src}
            alt={`${name} product shot`}
            width={cutout.width}
            height={cutout.height}
            priority
            // No drop-shadow below md: on the ink background it's barely
            // visible, and animating five filtered images is expensive on iOS.
            className="h-[42vh] w-auto object-contain md:h-[58vh] md:drop-shadow-2xl"
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
  slides: HeroSlide[];
}

function TeeStage({ p, zoom, gate, mobile, slides }: TeeStageProps) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden pb-16 will-change-transform"
      style={{ scale: zoom }}
    >
      {/* Soft glow behind the tees. Drawn with a radial gradient rather than
          a blur() filter: a 110px blur inside this zooming stage was one of
          the costliest things to repaint on iOS WebKit during fast scrolls. */}
      <div
        aria-hidden
        className="absolute h-[calc(46vh+220px)] w-[calc(46vh+220px)] md:h-[calc(54vh+220px)] md:w-[calc(54vh+220px)]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(58,58,56,0.4), rgba(58,58,56,0.28) 45%, rgba(58,58,56,0) 100%)",
        }}
      />
      {slides.map((slide, i) => (
        <TeeItem
          key={slide.id}
          p={p}
          index={i}
          isFirst={i === 0}
          isLast={i === slides.length - 1}
          gate={gate}
          cutout={slide.image}
          name={slide.product.name}
          code={slide.product.code}
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

/** Single-screen hero: used under reduced motion, and when no slides are
    configured yet (then it's just the copy on the dark stage). */
function StaticHero({ slides }: { slides: HeroSlide[] }) {
  const first = slides[0];
  const fullOpacity = useMotionValue(1);
  const noOffset = useMotionValue(0);

  return (
    <section id="home-hero" className="relative flex h-[100svh] min-h-[560px] w-full items-end overflow-hidden bg-ink">
      {first && (
        <div className="absolute inset-0 flex items-center justify-center pb-16">
          <Link
            href={`/product/${first.product.code}`}
            aria-label={`View ${first.product.name}`}
            data-cursor="View"
            className="block"
          >
            <Image
              src={first.image.src}
              alt={`${first.product.name} product shot`}
              width={first.image.width}
              height={first.image.height}
              priority
              className="h-[42vh] w-auto object-contain drop-shadow-2xl md:h-[58vh]"
            />
          </Link>
        </div>
      )}
      <HeroCopy active={first?.product ?? null} opacity={fullOpacity} y={noOffset} />
    </section>
  );
}

export function Hero({ slides }: { slides: HeroSlide[] }) {
  const count = slides.length;
  // Scroll is spent on the moves *between* tees (count - 1 of them), so the
  // section releases the page the moment the last tee lands centered,
  // instead of holding it pinned for another screen of scroll.
  const steps = Math.max(count - 1, 0);
  const TOTAL_VH = INTRO_VH + steps * PER_TEE_VH;
  const INTRO_END = INTRO_VH / TOTAL_VH;
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
  // tees. `p` stays clamped at 0 until the intro finishes.
  const chromeOpacity = useTransform(smoothScrollYProgress, [0, INTRO_END], [1, 0]);
  const chromeY = useTransform(smoothScrollYProgress, [0, INTRO_END], [0, -18]);
  const teeZoom = useTransform(smoothScrollYProgress, [0, INTRO_END], [1, 1.35]);
  // With a single slide there's no carousel range (INTRO_END is 1); keep
  // the input range non-degenerate so `p` just stays at 0.
  const p = useTransform(smoothScrollYProgress, [INTRO_END, Math.max(1, INTRO_END + 1e-4)], [0, steps]);
  // Sharp on/off switch for neighbor previews: 0 for the entire intro phase
  // (where scroll position is pinned), 1 the instant real cycling begins.
  const previewGate = useTransform(
    smoothScrollYProgress,
    [INTRO_END - 0.001, INTRO_END],
    [0, 1]
  );

  useMotionValueEvent(p, "change", (v) => {
    const idx = Math.min(count - 1, Math.max(0, Math.round(v)));
    setActiveIndex((prev) => (prev === idx ? prev : idx));
  });

  // "Gravity" snap: once scrolling settles inside the carousel phase, glide
  // to the nearest tee so the stage never rests between two shirts. Past
  // the halfway point between two tees, the next one pulls in; short of
  // it, the current one pulls back. Reads the raw scroll position (not the
  // spring) so the target is exact. Skipped while a finger is on the screen
  // so it never fights a drag.
  useEffect(() => {
    if (shouldReduceMotion) return;

    const last = count - 1;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let touching = false;

    function measure() {
      const el = wrapperRef.current;
      if (!el) return null;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const range = el.offsetHeight - window.innerHeight;
      if (range <= 0) return null;
      const progress = (window.scrollY - top) / range;
      const raw = steps > 0 ? ((progress - INTRO_END) / (1 - INTRO_END)) * steps : 0;
      return { top, range, progress, raw };
    }

    function snap() {
      if (touching) return;
      const m = measure();
      if (!m) return;
      const { top, range, progress, raw } = m;
      // Intro phase and the space past the last tee scroll freely.
      if (progress <= INTRO_END || progress >= 1 || raw >= last) return;

      // Nearest tee: reaching halfway (0.5) or more pulls in the next one.
      // The small epsilon absorbs sub-pixel float error right at the midpoint.
      const target = Math.min(last, Math.max(0, Math.floor(raw + 0.5 + 0.003)));
      if (Math.abs(raw - target) < 0.01) return; // already resting on it

      const targetProgress = INTRO_END + (target / steps) * (1 - INTRO_END);
      glideTo(top + targetProgress * range);
    }

    // Our own glide instead of scrollTo({ behavior: "smooth" }): on iOS
    // WebKit a native smooth scroll can keep running under a new touch and
    // fight the finger. This one is cancelled the instant the user touches
    // or wheels. Scroll-behavior is forced to auto while it runs, since the
    // global `scroll-behavior: smooth` would otherwise smooth every step.
    let glideFrame = 0;
    let gliding = false;
    function glideTo(targetY: number) {
      stopGlide();
      const startY = window.scrollY;
      const distance = targetY - startY;
      const duration = 450;
      const html = document.documentElement;
      html.style.scrollBehavior = "auto";
      gliding = true;
      let start = 0;
      const step = (now: number) => {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        window.scrollTo(0, startY + distance * eased);
        if (t < 1) glideFrame = requestAnimationFrame(step);
        else stopGlide();
      };
      glideFrame = requestAnimationFrame(step);
    }
    function stopGlide() {
      cancelAnimationFrame(glideFrame);
      if (gliding) document.documentElement.style.scrollBehavior = "";
      gliding = false;
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
      // Our own glide's scroll events shouldn't re-arm the snap mid-glide.
      if (gliding) return;
      schedule();
    }
    function onWheel() {
      lastInputTouch = false;
      stopGlide();
    }
    function onTouchStart() {
      touching = true;
      lastInputTouch = true;
      stopGlide();
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
      stopGlide();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [shouldReduceMotion, count, steps, INTRO_END]);

  // No carousel without slides (none configured yet in /admin/hero).
  if (shouldReduceMotion || count === 0) {
    return <StaticHero slides={slides} />;
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
        <TeeStage key={isMobile ? "m" : "d"} p={p} zoom={teeZoom} gate={previewGate} mobile={isMobile} slides={slides} />

        <HeroCopy active={slides[activeIndex]?.product ?? null} opacity={chromeOpacity} y={chromeY} />

        <motion.div
          style={{ opacity: chromeOpacity }}
          // On mobile it's smaller and sits lower, below the CTA / product
          // name row, so the three can't collide even on 320px screens.
          className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5 text-[8px] md:bottom-6 uppercase tracking-[0.2em] text-bone/60 md:gap-2 md:text-[10px] md:tracking-widest2"
          aria-hidden
        >
          Scroll
          <motion.span
            className="h-4 w-px bg-bone/40 md:h-8"
            animate={{ scaleY: [0.4, 1, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </section>
  );
}
