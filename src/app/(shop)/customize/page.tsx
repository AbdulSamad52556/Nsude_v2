import type { Metadata } from "next";
import Link from "next/link";
import { getBlanks, getCustomSettings } from "@/lib/server/custom";
import { priceFor } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { customPrice, PRINT_SIDES, sidePhoto, type PrintSide } from "@/lib/custom";
import { CustomDesigner, type DesignerBlank } from "@/components/customize/CustomDesigner";
import { DESIGN_FONT_FAMILY, designFontVariables } from "./fonts";

export const metadata: Metadata = {
  title: "Design Your Own T-Shirt",
  description:
    "Create a custom NSUDE T-shirt: upload your artwork or add your own text, place it on the front or back, and see it live before you order.",
};

// Stock and prices change from the admin panel; always read them fresh.
export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Pick your tee", text: "Choose the fit and colour of the blank you want printed." },
  { title: "Make the design", text: "Place your print areas where you want them, then add artwork or text and size it." },
  { title: "Order it", text: "See the price as you go. We check every design, print it and ship it to you." },
];

const TIPS = [
  "PNG files with a transparent background give the cleanest print.",
  "Use the largest image you have; small images can look blurry when printed big.",
  "Add more print areas for a chest logo or a second print; only what's inside an area is printed.",
  "Only upload artwork you own or have the right to print.",
];

export default async function CustomizePage() {
  const [settings, rows] = await Promise.all([getCustomSettings(), getBlanks()]);
  const blanks: DesignerBlank[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    fit: p.fit,
    material: p.material,
    sizes: p.sizes,
    colours: p.variants.map((v) => ({
      code: v.code,
      name: v.name,
      hex: v.hex,
      views: Object.fromEntries(PRINT_SIDES.map((s) => [s, sidePhoto(v.images, s)])) as Record<PrintSide, string | null>,
      stock: v.stock,
      unavailable: v.unavailableSizes,
      prices: Object.fromEntries(p.sizes.map((s) => [s, priceFor(p, v, s)])),
    })),
  }));
  const open = settings.enabled && blanks.length > 0;
  const fromPrice = open
    ? Math.min(...blanks.flatMap((b) => b.colours.flatMap((c) => Object.values(c.prices) as number[])))
    : 0;

  return (
    <div className={`px-5 pb-24 pt-24 md:px-10 md:pb-32 md:pt-28 ${designFontVariables}`}>
      <header className="mb-8 max-w-2xl md:mb-10">
        <span className="mb-3 block text-xs uppercase tracking-widest2 text-ash">Custom tees</span>
        <h1 className="text-3xl font-medium uppercase tracking-tighter text-ink md:text-5xl">Design your own</h1>
        <p className="mt-3 text-sm text-graphite md:text-base">
          Your artwork, your words, on our heavyweight tees.
          {open && <> From {formatPrice(customPrice(fromPrice, ["front"], settings))} with a front print.</>}
        </p>
      </header>

      {open ? (
        <CustomDesigner blanks={blanks} settings={settings} fontFamilies={DESIGN_FONT_FAMILY} />
      ) : (
        <div className="flex flex-col items-center gap-6 rounded-md border border-taupe/40 px-6 py-24 text-center">
          <p className="text-sm uppercase tracking-widest2 text-ash">Custom printing opens soon</p>
          <Link
            href="/shop"
            className="rounded-md inline-flex h-12 items-center bg-ink px-7 text-xs uppercase tracking-widest2 text-paper hover:bg-graphite"
          >
            Shop our designs
          </Link>
        </div>
      )}

      <section className="mt-20 grid grid-cols-1 gap-10 border-t border-taupe/40 pt-12 md:mt-28 md:grid-cols-2 md:gap-16">
        <div>
          <h2 className="mb-6 text-2xl font-medium uppercase tracking-tighter text-ink md:text-3xl">How it works</h2>
          <ol className="flex flex-col gap-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink text-xs text-ink">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm uppercase tracking-wide text-ink">{s.title}</p>
                  <p className="mt-1 text-sm text-graphite">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="mb-6 text-2xl font-medium uppercase tracking-tighter text-ink md:text-3xl">For the best print</h2>
          <ul className="flex flex-col gap-3">
            {TIPS.map((t) => (
              <li key={t} className="flex gap-3 text-sm text-graphite">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
