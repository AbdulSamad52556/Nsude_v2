import { pageAdmin } from "@/lib/server/auth";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { ProductForm } from "@/components/admin/ProductForm";
import { productCategoryTree } from "@/lib/server/productCategories";

export const metadata = { title: "New Product" };

export default async function NewProductPage({ searchParams }: { searchParams: { blank?: string } }) {
  await pageAdmin("products.manage");
  const categories = await productCategoryTree();
  return (
    <div>
      {searchParams.blank ? (
        <AdminPageHeader title="New Blank Tee" subtitle="A plain tee customers can print their own design on. It isn't listed in the shop." />
      ) : (
        <AdminPageHeader title="New Product" subtitle="It appears in the shop as soon as you create it." />
      )}
      <ProductForm categories={categories} newBlank={Boolean(searchParams.blank)} />
    </div>
  );
}
