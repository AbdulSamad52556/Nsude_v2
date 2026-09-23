import { db } from "@/lib/server/db";
import { getHeroSlides } from "@/lib/server/products";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { HeroEditor } from "@/components/admin/HeroEditor";

export const metadata = { title: "Hero Carousel" };

export default async function AdminHeroPage() {
  const [slides, products] = await Promise.all([
    getHeroSlides(),
    db.product.findMany({
      select: { id: true, name: true, price: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Hero Carousel"
        subtitle="The t-shirts that rotate in the home page hero as visitors scroll."
      />
      <HeroEditor initialSlides={slides} products={products} />
    </div>
  );
}
