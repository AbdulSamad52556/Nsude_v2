import type { Metadata } from "next";
import Image from "next/image";
import { campaignImages } from "@/lib/images";
import { AnimatedText } from "@/components/ui/AnimatedText";
import { Reveal } from "@/components/ui/Reveal";
import { Philosophy } from "@/components/home/Philosophy";

export const metadata: Metadata = {
  title: "About",
  description:
    "NSUDE is a premium menswear label built around one idea — fewer, better essentials made from exceptional cotton, cut to last.",
};

export default function AboutPage() {
  return (
    <div>
      <section className="relative flex h-[70vh] min-h-[480px] items-end overflow-hidden bg-ink">
        <Image
          src={campaignImages.aboutHero}
          alt="NSUDE studio, editorial imagery"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
        <div className="relative z-10 px-5 pb-16 md:px-10 md:pb-20">
          <AnimatedText
            text="Built for the everyday. Designed to last."
            className="max-w-3xl text-display-lg font-medium uppercase tracking-tighter text-bone"
          />
        </div>
      </section>

      <section className="bg-paper px-5 py-28 md:px-10 md:py-36">
        <div className="mx-auto grid max-w-content grid-cols-1 gap-12 md:grid-cols-12">
          <Reveal className="md:col-span-5">
            <span className="text-xs uppercase tracking-widest2 text-ash">
              The Manifesto
            </span>
          </Reveal>
          <div className="flex flex-col gap-6 md:col-span-7">
            <Reveal>
              <p className="text-2xl leading-snug text-ink md:text-3xl">
                NSUDE started with a frustration: too many clothes, not
                enough substance. Fast cycles. Thin fabric. Fit that changes
                every season for no reason at all.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-sm leading-relaxed text-graphite md:text-base">
                We build one category — men&apos;s T-shirts — and we build it
                properly. Heavyweight, long-staple cotton. Patterns tested
                across every size, not just scaled up or down. Construction
                that&apos;s meant to survive years of washing, not one
                season of wear.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="text-sm leading-relaxed text-graphite md:text-base">
                There&apos;s no logo across the chest. No seasonal gimmick.
                Just a considered silhouette, in a small number of colors,
                made to work with everything already in your wardrobe. Quiet
                confidence, not loud branding.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-1 md:grid-cols-2">
        <div className="relative aspect-[4/5] md:aspect-auto">
          <Image
            src={campaignImages.aboutSecondary}
            alt="NSUDE fabric detail"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col justify-center gap-6 bg-ink px-8 py-16 text-bone md:px-14">
          <span className="text-xs uppercase tracking-widest2 text-stone">
            Materials
          </span>
          <h2 className="text-display-md font-medium uppercase tracking-tighter">
            Fabric first.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-mist md:text-base">
            Every fabric is chosen for weight, density, and how it ages —
            not how it photographs on day one. We work in small batches with
            mills that specialize in heavyweight cotton jersey, so every tee
            holds its shape long after the label has been forgotten.
          </p>
        </div>
      </section>

      <Philosophy />
    </div>
  );
}
