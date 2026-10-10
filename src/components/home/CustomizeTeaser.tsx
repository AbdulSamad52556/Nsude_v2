import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ImagePlus, Move, ShoppingBag } from "lucide-react";
import type { PrintArea } from "@/lib/custom";
import { formatPrice } from "@/lib/utils";
import { Reveal } from "@/components/ui/Reveal";
import { MagneticButton } from "@/components/ui/MagneticButton";

const STEPS = [
  { icon: ImagePlus, text: "Upload your artwork or add your own words" },
  { icon: Move, text: "Place it on the front or back and see it live" },
  { icon: ShoppingBag, text: "Order it; we print and ship it to you" },
];

/** Home page invitation to the custom-tee designer. */
export function CustomizeTeaser({
  photo,
  area,
  fromPrice,
}: {
  /** A blank tee's front photo. */
  photo: { src: string; alt: string };
  /** The front printable zone on that photo. */
  area: PrintArea;
  fromPrice: number;
}) {
  return (
    <section className="bg-paper px-5 py-24 md:px-10 md:py-32">
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16 lg:gap-24">
        <Reveal>
          <Link href="/customize" data-cursor="Design" className="group relative mx-auto block aspect-[4/5] w-full max-w-[520px] overflow-hidden rounded-md bg-bone">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(min-width: 768px) 45vw, 100vw"
              className="object-cover transition-transform duration-700 ease-editorial group-hover:scale-[1.03]"
            />
            <div
              className="absolute flex items-center justify-center border-2 border-dashed border-ink/40 transition-colors group-hover:border-ink"
              style={{ left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.w * 100}%`, height: `${area.h * 100}%` }}
            >
              <span className="px-2 text-center font-display text-lg font-medium uppercase leading-tight tracking-tighter text-ink/70 md:text-2xl">
                Your design here
              </span>
            </div>
          </Link>
        </Reveal>

        <div>
          <Reveal>
            <span className="mb-4 block text-xs uppercase tracking-widest2 text-ash">Make it yours</span>
            <h2 className="text-display-md font-medium uppercase tracking-tighter text-ink">Design your own tee.</h2>
            <p className="mt-5 max-w-md text-sm text-graphite md:text-base">
              Our heavyweight blanks, printed with whatever you bring: a logo, a photo, a line that means something.
            </p>
          </Reveal>
          <ul className="mt-8 flex flex-col gap-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.text} delay={0.1 + i * 0.06}>
                <li className="flex items-center gap-4 text-sm text-ink">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-taupe/60">
                    <s.icon size={16} strokeWidth={1.5} />
                  </span>
                  {s.text}
                </li>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={0.3} className="mt-10 flex flex-wrap items-center gap-5">
            <MagneticButton>
              <Link
                href="/customize"
                className="group inline-flex h-12 items-center gap-3 rounded-md bg-ink px-7 text-xs uppercase tracking-widest2 text-paper transition-colors hover:bg-graphite"
              >
                Start designing
                <ArrowRight size={16} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </MagneticButton>
            <span className="text-xs uppercase tracking-widest2 text-ash">From {formatPrice(fromPrice)}</span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
