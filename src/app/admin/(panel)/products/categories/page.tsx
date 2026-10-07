import { db } from "@/lib/server/db";
import { pageAdmin } from "@/lib/server/auth";
import { can } from "@/lib/adminPermissions";
import { PRODUCT_TABS } from "@/lib/types";
import { productCategoryTree } from "@/lib/server/productCategories";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { SectionTabs } from "@/components/admin/SectionTabs";
import { CategoryManager } from "@/components/admin/CategoryManager";

export const metadata = { title: "Product categories" };

/** Shop categories and sub-categories, with how many products are in each. */
export default async function ProductCategoriesPage() {
  const admin = await pageAdmin("products.view");
  const [tree, byCategory, bySub] = await Promise.all([
    productCategoryTree(),
    db.product.groupBy({ by: ["category"], _count: { _all: true } }),
    db.product.groupBy({ by: ["category", "subcategory"], where: { subcategory: { not: null } }, _count: { _all: true } }),
  ]);
  const usage: Record<string, { count: number }> = {};
  for (const c of tree) {
    usage[c.id] = { count: byCategory.find((g) => g.category === c.name)?._count._all ?? 0 };
    for (const s of c.children) {
      usage[s.id] = { count: bySub.find((g) => g.category === c.name && g.subcategory === s.name)?._count._all ?? 0 };
    }
  }

  return (
    <div>
      <AdminPageHeader title="Products" subtitle="Shop categories and sub-categories. They appear in the shop filters and on the home page." />
      <SectionTabs tabs={PRODUCT_TABS} active="/admin/products/categories" />
      <CategoryManager
        tree={tree}
        usage={usage}
        canManage={can(admin, "products.manage")}
        apiBase="/api/admin/products/categories"
        unit="product"
        placeholder="New category, e.g. Hoodies"
        note="Renaming moves its products and shop links with it. Hidden categories disappear from the shop filters; their products stay in the shop. Only empty categories can be deleted."
      />
    </div>
  );
}
