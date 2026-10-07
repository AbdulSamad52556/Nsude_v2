import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimatedText } from "@/components/ui/AnimatedText";
import { Reveal } from "@/components/ui/Reveal";

// Three things every NSUDE tee has (from The NSUDE Standard below).
const facts = [
  { title: "Heavyweight cotton", copy: "Long-staple, dense, holds its shape" },
  { title: "Pre-shrunk", copy: "Fits the same after every wash" },
  { title: "Reinforced seams", copy: "Made for daily wear, not display" },
];

export function BrandStatement() {
  return (
    <section className="border-t border-taupe/30 bg-paper px-5 py-24 md:px-10 md:py-36">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-10">
        <AnimatedText
          as="h2"
          by="line"
          text={"We don't make more clothes.\nWe make the ones you keep."}
          className="text-display-lg font-medium uppercase tracking-tighter text-ink md:col-span-7"
        />
        <div className="flex flex-col justify-end gap-8 md:col-span-4 md:col-start-9">
          <Reveal delay={0.2}>
            <p className="text-sm leading-relaxed text-graphite md:text-base">
              NSUDE exists against the churn — fewer releases, better fabric, fit tested until it disappears on the body.
              Every tee is designed to outlast the season it was made for.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <Link
              href="/about"
              className="group inline-flex items-center gap-2 border-b border-ink pb-1 text-xs uppercase tracking-widest2 text-ink"
            >
              Our story
              <ArrowRight size={14} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 border-t border-taupe/40 sm:grid-cols-3 md:mt-24">
        {facts.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.08}>
            <div className="flex items-baseline gap-4 border-b border-taupe/40 py-6 sm:block sm:border-b-0 sm:py-8 sm:pr-8">
              <span className="text-xs text-taupe">0{i + 1}</span>
              <div className="sm:mt-4">
                <p className="text-sm font-medium uppercase tracking-wide text-ink">{f.title}</p>
                <p className="mt-1 text-sm text-ash">{f.copy}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
