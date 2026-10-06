import { pageAdmin } from "@/lib/server/auth";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ProductForm } from "@/components/admin/ProductForm";
import { productCategoryTree } from "@/lib/server/productCategories";

export const metadata = { title: "New Product" };

export default async function NewProductPage() {
  await pageAdmin("products.manage");
  const categories = await productCategoryTree();
  return (
    <div>
      <AdminPageHeader title="New Product" subtitle="It appears in the shop as soon as you create it." />
      <ProductForm categories={categories} />
    </div>
  );
}
