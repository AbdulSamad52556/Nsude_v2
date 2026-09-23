import { Hero } from "@/components/home/Hero";
import { BrandStatement } from "@/components/home/BrandStatement";
import { FeaturedCollection } from "@/components/home/FeaturedCollection";
import { CollectionCampaign } from "@/components/home/CollectionCampaign";
import { ShopTheFit } from "@/components/home/ShopTheFit";
import { Philosophy } from "@/components/home/Philosophy";
import { Marquee } from "@/components/ui/Marquee";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Marquee text="Premium Cotton — Considered Fit — Made to Keep —" />
      <BrandStatement />
      <FeaturedCollection />
      <CollectionCampaign />
      <ShopTheFit />
      <Philosophy />
    </>
  );
}
