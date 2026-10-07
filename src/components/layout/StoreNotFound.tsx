import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getFeaturedCards } from "@/lib/server/listings";
import { ProductCard } from "@/components/product/ProductCard";

/** Storefront 404: a clear way back, plus a few pieces to keep browsing. */
export async function StoreNotFound() {
  // Suggestions are a bonus; a database hiccup shouldn't break the 404.
  const picks = await getFeaturedCards(4).catch(() => []);

  return (
    <div className="px-5 pb-20 pt-28 md:px-10 md:pb-28 md:pt-36">
      <section className="relative mx-auto flex flex-col items-center text-center">
        {/* Oversized number behind the message. */}
        <span
          aria-hidden
          className="pointer-events-none select-none text-[clamp(7rem,28vw,18rem)] font-medium leading-none tracking-tighter text-sand/60"
        >
          404
        </span>
        <div className="-mt-[clamp(2.5rem,9vw,6rem)] flex flex-col items-center">
          <span className="rounded-full bg-ink px-3 py-1 text-[10px] uppercase tracking-widest2 text-paper">
            Page not found
          </span>
          <h1 className="mt-5 text-display-md font-medium uppercase tracking-tighter text-ink">
            This one&apos;s out of stock
          </h1>
          <p className="mt-3 max-w-sm text-sm text-graphite">
            The link may be broken or the page has moved. Everything else is right where you left it.
          </p>
          <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <Link
              href="/shop"
              className="group flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-6 text-xs uppercase tracking-widest2 text-paper transition-colors hover:bg-graphite md:h-12"
            >
              Shop all
              <ArrowRight size={15} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/"
              className="flex h-11 items-center justify-center gap-2 rounded-md border border-taupe/60 px-6 text-xs uppercase tracking-widest2 text-ink transition-colors hover:border-ink hover:text-ink md:h-12"
            >
              <ArrowLeft size={15} strokeWidth={1.5} /> Back to home
            </Link>
          </div>
        </div>
      </section>

      {picks.length > 0 && (
        <section className="mx-auto mt-20 md:mt-28">
          <div className="mb-6 flex items-end justify-between gap-4 border-t border-taupe/30 pt-8">
            <h2 className="text-xs uppercase tracking-widest2 text-ink">You might like</h2>
            <Link href="/shop" className="text-[11px] uppercase tracking-widest2 text-ash hover:text-ink">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-x-6">
            {picks.map((card) => (
              <ProductCard key={card.code} card={card} imageSizes="(min-width: 768px) 25vw, 50vw" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
