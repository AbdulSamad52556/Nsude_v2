"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { campaignImages } from "@/lib/images";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { AnimatedText } from "@/components/ui/AnimatedText";
import { Reveal } from "@/components/ui/Reveal";

/** Home page photo banner leading to all collections. */
export function CollectionCampaign() {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? ["0%", "0%"] : ["-8%", "8%"]);

  return (
    <section id="collection" ref={ref} className="relative h-[60vh] max-h-[620px] min-h-[400px] overflow-hidden bg-ink">
      {/* The photo drifts with the scroll; it's taller than the section so
          no edge ever shows. */}
      <motion.div className="absolute inset-x-0 -inset-y-[10%]" style={{ y }}>
        <Image
          src={campaignImages.collectionCampaign}
          alt="Stacks of folded NSUDE T-shirts in black, white, green, blue and clay on a wooden table"
          fill
          sizes="100vw"
          className="object-cover"
        />
      </motion.div>
      {/* The tint stays put, so it always covers the whole section. */}
      <div className="absolute inset-0 bg-ink/40" />

      <div className="relative z-10 flex h-full flex-col items-start justify-end px-5 pb-12 md:px-10 md:pb-16">
        <Reveal>
          <span className="mb-4 block text-xs uppercase tracking-widest2 text-paper/70">Collections</span>
        </Reveal>
        <AnimatedText
          text="Curated, not crowded."
          className="max-w-2xl text-4xl font-medium uppercase leading-[0.95] tracking-tighter text-paper md:text-6xl"
        />
        <Reveal delay={0.15}>
          <p className="mt-4 max-w-md text-sm text-paper/80 md:text-base">
            Small edits of our essentials, each built around one idea.
          </p>
        </Reveal>
        <Reveal delay={0.25} className="mt-7">
          <MagneticButton>
            <Link
              href="/collections"
              className="group inline-flex h-12 items-center gap-3 rounded-md bg-paper px-7 text-xs uppercase tracking-widest2 text-ink transition-colors hover:bg-sand"
            >
              Explore Collections
              <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </MagneticButton>
        </Reveal>
      </div>
    </section>
  );
}
