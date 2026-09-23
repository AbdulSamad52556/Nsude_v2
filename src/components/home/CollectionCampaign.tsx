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

export function CollectionCampaign() {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? ["0%", "0%"] : ["-8%", "8%"]);

  return (
    <section id="collection" ref={ref} className="relative h-[85vh] min-h-[560px] overflow-hidden bg-ink">
      <motion.div className="absolute inset-0" style={{ y }}>
        <Image
          src={campaignImages.collectionCampaign}
          alt="The NSUDE Collection campaign imagery"
          fill
          sizes="100vw"
          className="scale-110 object-cover"
        />
        <div className="absolute inset-0 bg-ink/40" />
      </motion.div>

      <div className="relative z-10 flex h-full flex-col items-start justify-end px-5 pb-16 md:px-10 md:pb-24">
        <Reveal>
          <span className="mb-4 block text-xs uppercase tracking-widest2 text-bone/70">
            Form / Function
          </span>
        </Reveal>
        <AnimatedText
          text="The NSUDE Collection"
          className="max-w-3xl text-display-lg font-medium uppercase tracking-tighter text-bone"
        />
        <Reveal delay={0.2} className="mt-8">
          <MagneticButton>
            <Link
              href="/shop"
              className="group inline-flex items-center gap-3 border-b border-bone pb-1 text-sm uppercase tracking-widest2 text-bone"
            >
              Explore Collection
              <ArrowRight
                size={16}
                strokeWidth={1.5}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
          </MagneticButton>
        </Reveal>
      </div>
    </section>
  );
}
