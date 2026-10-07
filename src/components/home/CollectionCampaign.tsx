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

/** The collection chosen as the home banner (admin), or null for the
    default campaign that links to the whole shop. The tall campaign photo
    stays either way: collection banners are thin strips made for 300px. */
type Featured = { name: string; slug: string; tagline: string } | null;

export function CollectionCampaign({ collection }: { collection: Featured }) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? ["0%", "0%"] : ["-8%", "8%"]);

  return (
    <section id="collection" ref={ref} className="relative h-[60vh] max-h-[620px] min-h-[400px] overflow-hidden bg-ink">
      <motion.div className="absolute inset-0" style={{ y }}>
        <Image
          src={campaignImages.collectionCampaign}
          alt="Stacks of folded NSUDE T-shirts in black, white, green, blue and clay on a wooden table"
          fill
          sizes="100vw"
          className="scale-110 object-cover"
        />
        <div className="absolute inset-0 bg-ink/40" />
      </motion.div>

      <div className="relative z-10 flex h-full flex-col items-start justify-end px-5 pb-12 md:px-10 md:pb-16">
        <Reveal>
          <span className="mb-4 block text-xs uppercase tracking-widest2 text-paper/70">
            {collection ? "The collection" : "Form / Function"}
          </span>
        </Reveal>
        <AnimatedText
          text={collection?.name ?? "The NSUDE Collection"}
          className="max-w-3xl text-display-lg font-medium uppercase tracking-tighter text-paper"
        />
        {collection?.tagline && (
          <Reveal delay={0.15}>
            <p className="mt-4 max-w-xl text-sm text-paper/80 md:text-base">{collection.tagline}</p>
          </Reveal>
        )}
        <Reveal delay={0.2} className="mt-8">
          <MagneticButton>
            <Link
              href={collection ? `/collections/${collection.slug}` : "/shop"}
              className="group inline-flex h-12 items-center gap-3 rounded-md bg-paper px-7 text-xs uppercase tracking-widest2 text-ink transition-colors hover:bg-sand"
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
