import type { MetadataRoute } from "next";
import { db } from "@/lib/server/db";
import { productHref } from "@/lib/types";

const siteUrl = "https://nsude.example.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    "",
    "/shop",
    "/collections",
    "/customize",
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

  const collections = await db.collection.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } });
  const collectionRoutes = collections.map((c) => ({
    url: `${siteUrl}/collections/${c.slug}`,
    lastModified: c.updatedAt,
  }));

  return [...staticRoutes, ...collectionRoutes, ...productRoutes];
}
