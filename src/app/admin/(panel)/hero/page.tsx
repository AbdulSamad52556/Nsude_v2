import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { getHeroSlides, toProduct } from "@/lib/server/products";
import { priceRange } from "@/lib/types";
import { formatPriceRange } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { HeroEditor } from "@/components/admin/HeroEditor";
import { ReadOnly } from "@/components/admin/ReadOnly";

export const metadata = { title: "Hero Carousel" };

export default async function AdminHeroPage() {
  const admin = await pageAdmin("hero.view");
  const [slides, rows] = await Promise.all([
    getHeroSlides(),
    db.product.findMany({ where: { blank: { not: true } }, orderBy: { name: "asc" } }),
  ]);
  // A slide links to the product's default color, so show that color's price.
  const products = rows.map(toProduct).map((p) => ({
    id: p.id,
    name: p.name,
    priceLabel: formatPriceRange(priceRange(p, p.variants.slice(0, 1))),
  }));

  return (
    <div>
      <AdminPageHeader
        title="Hero Carousel"
        subtitle="The t-shirts that rotate in the home page hero as visitors scroll."
      />
      <ReadOnly when={!can(admin, "hero.manage")}>
        <HeroEditor initialSlides={slides} products={products} />
      </ReadOnly>
    </div>
  );
}
