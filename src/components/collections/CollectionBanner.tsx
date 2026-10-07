import Image from "next/image";
import { cx } from "@/lib/utils";

export type BannerData = {
  name: string;
  tagline: string;
  count: number;
  image: { src: string; alt: string } | null;
  photos: { src: string; alt: string }[];
};

/**
 * The collection strip: full width, 250px tall on phones, 300px from
 * tablets up. Shows the cropped banner, or (without one) the collection's
 * product photos on black. Text sits on the left.
 */
export function CollectionBanner({
  c,
  heading: Heading = "h2",
  eyebrow,
  footer,
  priority,
  zoomOnHover,
}: {
  c: BannerData;
  heading?: "h1" | "h2";
  eyebrow?: React.ReactNode;
  footer?: React.ReactNode;
  priority?: boolean;
  zoomOnHover?: boolean;
}) {
  const zoom = zoomOnHover && "transition-transform duration-700 ease-editorial group-hover:scale-[1.03]";
  return (
    <div className="relative h-[250px] w-full overflow-hidden rounded-md bg-ink md:h-[300px]">
      {c.image ? (
        <Image src={c.image.src} alt={c.image.alt} fill priority={priority} sizes="100vw" className={cx("object-cover", zoom)} />
      ) : (
        // No banner: the products, side by side on the right.
        <div className="absolute inset-y-0 right-0 flex w-[62%] gap-px sm:w-[55%] md:w-1/2">
          {c.photos.map((p, i) => (
            <div key={i} className={cx("relative h-full flex-1 overflow-hidden", i >= 2 && "hidden sm:block")}>
              <Image src={p.src} alt={p.alt} fill priority={priority && i < 2} sizes="(min-width: 768px) 15vw, 30vw" className={cx("object-cover", zoom)} />
            </div>
          ))}
        </div>
      )}
      <div
        className={cx(
          "absolute inset-0",
          c.image
            ? "bg-gradient-to-r from-ink/80 via-ink/35 to-ink/0"
            : "bg-gradient-to-r from-ink from-[38%] via-ink/60 via-[55%] to-ink/0 sm:from-[45%] md:from-[50%]"
        )}
      />
      <div className="relative z-10 flex h-full max-w-[75%] flex-col justify-center px-6 md:max-w-[55%] md:px-12">
        {eyebrow && <div className="mb-3 text-[11px] uppercase tracking-widest2 text-paper/60">{eyebrow}</div>}
        <Heading className="text-3xl font-medium uppercase leading-[0.95] tracking-tighter text-paper md:text-5xl lg:text-6xl">
          {c.name}
        </Heading>
        {c.tagline && <p className="mt-3 line-clamp-2 max-w-md text-sm text-paper/80">{c.tagline}</p>}
        {footer && <div className="mt-5 text-[11px] uppercase tracking-widest2 text-paper">{footer}</div>}
      </div>
    </div>
  );
}
