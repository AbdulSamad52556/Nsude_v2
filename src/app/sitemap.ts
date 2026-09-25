import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/server/products";
import { productHref } from "@/lib/types";

const siteUrl = "https://nsude.example.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    "",
    "/shop",
    "/about",
    "/cart",
    "/contact",
    "/faq",
    "/shipping",
    "/returns",
    "/privacy",
    "/terms",
  ].map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
  }));

  // One page per colorway, e.g. /product/7K2Q.
  const productRoutes = (await getProducts()).flatMap((p) =>
    p.variants.map((v) => ({
      url: `${siteUrl}${productHref(v)}`,
      lastModified: new Date(),
    }))
  );

  return [...staticRoutes, ...productRoutes];
}
