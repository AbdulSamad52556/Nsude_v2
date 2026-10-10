import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getStoreCollections } from "@/lib/server/collections";
import { Reveal } from "@/components/ui/Reveal";
import { CollectionBanner } from "@/components/collections/CollectionBanner";

export const metadata: Metadata = {
  title: "Collections",
  description: "Curated NSUDE edits and drops — hand-picked groups of premium T-shirts, each with its own story.",
};

export default async function CollectionsPage() {
  const collections = await getStoreCollections();
  return (
    <div className="px-5 pb-24 pt-24 md:px-10 md:pb-32 md:pt-28">
      <header className="mb-6 md:mb-8">
        <h1 className="text-3xl font-medium uppercase tracking-tighter text-ink md:text-4xl">Collections</h1>
        <p className="mt-2 text-sm text-graphite">Hand-picked edits and drops, each built around one idea.</p>
      </header>
      <div>
        {collections.length === 0 ? (
          <div className="flex flex-col items-center gap-6 rounded-md border border-taupe/40 py-24 text-center">
            <p className="text-sm uppercase tracking-widest2 text-ash">New collections are on the way</p>
            <Link
              href="/shop"
              className="rounded-md inline-flex h-12 items-center bg-ink px-7 text-xs uppercase tracking-widest2 text-paper hover:bg-graphite"
            >
              Shop everything
            </Link>
          </div>
        ) : (
          // One strip per collection, line by line.
          <ul className="flex flex-col gap-4 md:gap-6">
            {collections.map((c, i) => (
              <li key={c.slug}>
                <Reveal delay={i < 3 ? i * 0.06 : 0}>
                  <Link href={`/collections/${c.slug}`} data-cursor="View" className="group block">
                    <CollectionBanner
                      c={c}
                      priority={i < 2}
                      zoomOnHover
                      eyebrow={String(i + 1).padStart(2, "0")}
                      footer={
                        <span className="inline-flex items-center gap-2">
                          {c.count} {c.count === 1 ? "piece" : "pieces"}
                          <span className="text-paper/40">·</span>
                          <span className="inline-flex items-center gap-1.5 border-b border-paper/40 pb-0.5 transition-colors group-hover:border-paper">
                            Explore
                            <ArrowRight size={13} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-1" />
                          </span>
                        </span>
                      }
                    />
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
