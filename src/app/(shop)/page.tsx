import { Hero } from "@/components/home/Hero";
import { BrandStatement } from "@/components/home/BrandStatement";
import { FeaturedCollection } from "@/components/home/FeaturedCollection";
import { CollectionCampaign } from "@/components/home/CollectionCampaign";
import { ShopTheFit } from "@/components/home/ShopTheFit";
import { Philosophy } from "@/components/home/Philosophy";
import { Marquee } from "@/components/ui/Marquee";
import { getHeroSlides } from "@/lib/server/products";
import { getCardsByFit, getFeaturedCards } from "@/lib/server/listings";

// "Shop The Fit" tabs — each fetches only the three products it shows.
const FIT_TABS = ["Relaxed", "Regular", "Oversized"] as const;

export default async function HomePage() {
  const [slides, featured, ...byFit] = await Promise.all([
    getHeroSlides(),
    getFeaturedCards(4),
    ...FIT_TABS.map((fit) => getCardsByFit(fit, 3)),
  ]);
  const fitCards = Object.fromEntries(FIT_TABS.map((fit, i) => [fit, byFit[i]]));

  return (
    <>
      <Hero slides={slides} />
      <Marquee text="Premium Cotton — Considered Fit — Made to Keep —" />
      <BrandStatement />
      <FeaturedCollection cards={featured} />
      <CollectionCampaign />
      <ShopTheFit cardsByFit={fitCards} />
      <Philosophy />
    </>
  );
}
