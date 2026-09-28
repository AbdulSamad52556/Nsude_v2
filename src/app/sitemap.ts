import type { MetadataRoute } from "next";
import { db } from "@/lib/server/db";
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

  // One page per colorway, e.g. /product/7K2Q (codes only — no full products).
  const codes = await db.listing.findMany({ select: { code: true } });
  const productRoutes = codes.map((v) => ({
    url: `${siteUrl}${productHref(v)}`,
    lastModified: new Date(),
  }));

  return [...staticRoutes, ...productRoutes];
}
