import { Hero } from "@/components/home/Hero";
import { NewArrivals } from "@/components/home/NewArrivals";
import { BrandStatement } from "@/components/home/BrandStatement";
import { FeaturedCollection } from "@/components/home/FeaturedCollection";
import { ShopByCategory } from "@/components/home/ShopByCategory";
import { CollectionCampaign } from "@/components/home/CollectionCampaign";
import { CustomizeTeaser } from "@/components/home/CustomizeTeaser";
import { getCustomizeTeaser } from "@/lib/server/custom";
import { ShopTheFit } from "@/components/home/ShopTheFit";
import { Philosophy } from "@/components/home/Philosophy";
import { ServiceStrip } from "@/components/home/ServiceStrip";
import { Marquee } from "@/components/ui/Marquee";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/checkout";
import { formatPrice } from "@/lib/utils";
import { getHeroSlides } from "@/lib/server/products";
import { getCardsByFit, getCategoryTiles, getFeaturedCards, getNewArrivalCards } from "@/lib/server/listings";

// "Shop The Fit" tabs — each fetches only the three products it shows.
const FIT_TABS = ["Relaxed", "Regular", "Oversized"] as const;

export default async function HomePage() {
  const [slides, newIn, featured, categories, customize, ...byFit] = await Promise.all([
    getHeroSlides(),
    getNewArrivalCards(8),
    getFeaturedCards(4),
    getCategoryTiles(),
    getCustomizeTeaser(),
    ...FIT_TABS.map((fit) => getCardsByFit(fit, 3)),
  ]);
  const fitCards = Object.fromEntries(FIT_TABS.map((fit, i) => [fit, byFit[i]]));

  return (
    <>
      <Hero slides={slides} />
      <Marquee items={["Premium cotton", "Considered fit", "Made to keep", `Free shipping over ${formatPrice(FREE_SHIPPING_THRESHOLD)}`]} />
      <NewArrivals cards={newIn} />
      <BrandStatement />
      <FeaturedCollection cards={featured} />
      <ShopByCategory tiles={categories} />
      {customize && <CustomizeTeaser {...customize} />}
      <CollectionCampaign />
      <ShopTheFit cardsByFit={fitCards} />
      <Philosophy />
      <ServiceStrip />
    </>
  );
}
