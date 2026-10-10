import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { productHref, type CardData } from "@/lib/types";
import { cx, formatPriceRange } from "@/lib/utils";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";

/**
 * The first four featured products (set in /admin) as a lookbook:
 * a large lead piece, two beside it, and a fourth with its details. Every
 * photo keeps the same portrait shape, so nothing is cropped awkwardly.
 */
export function FeaturedCollection({ cards }: { cards: CardData[] }) {
  const [lead, second, third, fourth] = cards;
  if (!lead) return null;

  return (
    <section className="bg-sand/25 px-5 py-24 md:px-10 md:py-36">
      <div className="mb-12 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
        <SectionHeading
          eyebrow="Selected Pieces"
          title="The Essentials"
          subtitle="Designed to disappear into your wardrobe. Built to stand out from everything else."
        />
        <Link
          href="/shop"
          className="group inline-flex shrink-0 items-center gap-2 self-start border-b border-ink pb-1 text-xs uppercase tracking-widest2 text-ink md:self-auto"
        >
          View all
          <ArrowRight size={14} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-12 md:gap-6">
        <Reveal className="col-span-2 md:col-span-6" y={40}>
          <Tile card={lead} index={1} size="lead" priority />
        </Reveal>

        {(second || third || fourth) && (
          <div className="col-span-2 grid grid-cols-2 gap-3 md:col-span-6 md:gap-6">
            {second && (
              <Reveal delay={0.08} y={40}>
                <Tile card={second} index={2} />
              </Reveal>
            )}
            {third && (
              <Reveal delay={0.16} y={40}>
                <Tile card={third} index={3} />
              </Reveal>
            )}
            {fourth && (
              <Reveal delay={0.24} y={40} className="col-span-2">
                <DetailCard card={fourth} index={4} />
              </Reveal>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Photo with name and price over it; the second photo shows on hover. */
function Tile({
  card,
  index,
  size = "small",
  priority,
}: {
  card: CardData;
  index: number;
  size?: "lead" | "small";
  priority?: boolean;
}) {
  const [primary, secondary] = card.images;
  const lead = size === "lead";
  return (
    <Link
      href={productHref(card)}
      data-cursor="View"
      className="group relative block aspect-[4/5] overflow-hidden rounded-md bg-bone"
    >
      {primary && (
        <Image
          src={primary.src}
          alt={primary.alt || `${card.name} in ${card.colorName}`}
          fill
          priority={priority}
          sizes={lead ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"}
          className={cx(
            "object-cover transition-[transform,opacity] duration-700 ease-editorial group-hover:scale-[1.04]",
            secondary && "group-hover:opacity-0"
          )}
        />
      )}
      {secondary && (
        <Image
          src={secondary.src}
          alt=""
          fill
          sizes={lead ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"}
          className="scale-105 object-cover opacity-0 transition-[transform,opacity] duration-700 ease-editorial group-hover:scale-100 group-hover:opacity-100"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/0 to-transparent" />

      <span className="absolute left-3 top-3 rounded-full bg-paper/90 px-2.5 py-1 text-[10px] tracking-widest2 text-ink md:left-5 md:top-5">
        0{index}
      </span>
      {card.newArrival && !card.soldOut && (
        <span className="absolute right-3 top-3 bg-ink px-2.5 py-1 text-[10px] uppercase tracking-widest2 text-paper md:right-5 md:top-5">
          New
        </span>
      )}

      <div className={cx("absolute inset-x-0 bottom-0 flex items-end justify-between gap-4", lead ? "p-5 md:p-8" : "p-3 md:p-5")}>
        <div className="min-w-0">
          <p
            className={cx(
              "truncate font-display font-medium uppercase tracking-tighter text-paper",
              lead ? "text-2xl md:text-4xl" : "text-sm md:text-lg"
            )}
          >
            {card.name}
          </p>
          <p className={cx("mt-1 text-paper/75", lead ? "text-sm" : "text-[11px] md:text-xs")}>
            {card.colorName} · {formatPriceRange(card.price)}
          </p>
        </div>
        {lead ? (
          <span className="hidden shrink-0 items-center gap-2 rounded-md bg-paper px-5 py-3 text-xs uppercase tracking-widest2 text-ink transition-colors group-hover:bg-sand sm:inline-flex">
            Shop now <ArrowRight size={14} strokeWidth={1.5} />
          </span>
        ) : (
          <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-ink transition-transform duration-300 group-hover:rotate-45 md:flex">
            <ArrowUpRight size={16} strokeWidth={1.5} />
          </span>
        )}
      </div>
    </Link>
  );
}

/** Photo beside a details panel: colours, price and a link. */
function DetailCard({ card, index }: { card: CardData; index: number }) {
  const [primary, secondary] = card.images;
  return (
    <Link href={productHref(card)} data-cursor="View" className="group grid grid-cols-2 overflow-hidden rounded-md bg-paper">
      <div className="relative aspect-[4/5] overflow-hidden bg-bone">
        {primary && (
          <Image
            src={primary.src}
            alt={primary.alt || `${card.name} in ${card.colorName}`}
            fill
            sizes="(min-width: 768px) 25vw, 50vw"
            className={cx(
              "object-cover transition-[transform,opacity] duration-700 ease-editorial group-hover:scale-[1.04]",
              secondary && "group-hover:opacity-0"
            )}
          />
        )}
        {secondary && (
          <Image
            src={secondary.src}
            alt=""
            fill
            sizes="(min-width: 768px) 25vw, 50vw"
            className="scale-105 object-cover opacity-0 transition-[transform,opacity] duration-700 ease-editorial group-hover:scale-100 group-hover:opacity-100"
          />
        )}
      </div>
      <div className="flex flex-col justify-between p-4 md:p-8">
        <span className="text-[10px] tracking-widest2 text-ash">0{index}</span>
        <div>
          <p className="font-display text-base font-medium uppercase tracking-tighter text-ink md:text-2xl">{card.name}</p>
          <p className="mt-1 text-xs text-ash md:text-sm">{card.fit} fit</p>
          {card.swatches.length > 1 && (
            <div className="mt-4 flex items-center gap-1.5">
              {card.swatches.slice(0, 5).map((s) => (
                <span
                  key={s.code}
                  title={s.name}
                  className="h-3.5 w-3.5 rounded-full border border-taupe/60"
                  style={{ backgroundColor: s.hex }}
                />
              ))}
              <span className="ml-1 text-[11px] text-ash">{card.swatches.length} colours</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-taupe/30 pt-4">
          <span className="text-sm text-ink md:text-base">{formatPriceRange(card.price)}</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest2 text-ink">
            <span className="hidden sm:inline">Shop now</span>
            <ArrowUpRight size={15} strokeWidth={1.5} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
