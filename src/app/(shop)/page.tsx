import { Hero } from "@/components/home/Hero";
import { BrandStatement } from "@/components/home/BrandStatement";
import { FeaturedCollection } from "@/components/home/FeaturedCollection";
import { CollectionCampaign } from "@/components/home/CollectionCampaign";
import { ShopTheFit } from "@/components/home/ShopTheFit";
import { Philosophy } from "@/components/home/Philosophy";
import { Marquee } from "@/components/ui/Marquee";
import { getFeaturedProducts, getHeroSlides, getProducts } from "@/lib/server/products";

export default async function HomePage() {
  const [slides, featured, products] = await Promise.all([
    getHeroSlides(),
    getFeaturedProducts(),
    getProducts(),
  ]);

  return (
    <>
      <Hero slides={slides} />
      <Marquee text="Premium Cotton — Considered Fit — Made to Keep —" />
      <BrandStatement />
      <FeaturedCollection products={featured} />
      <CollectionCampaign />
      <ShopTheFit products={products} />
      <Philosophy />
    </>
  );
}
