import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/checkout", "/cart", "/admin", "/api"],
    },
    sitemap: "https://nsude.example.com/sitemap.xml",
  };
}
