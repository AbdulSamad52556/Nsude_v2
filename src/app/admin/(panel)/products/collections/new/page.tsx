import { pageAdmin } from "@/lib/server/auth";
import { collectionProductOptions } from "@/lib/server/collections";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { CollectionForm } from "@/components/admin/CollectionForm";

export const metadata = { title: "New Collection" };

export default async function NewCollectionPage() {
  await pageAdmin("products.manage");
  const products = await collectionProductOptions();
  return (
    <div>
      <AdminPageHeader title="New Collection" subtitle="Starts as a draft unless you tick Show on the site." />
      <CollectionForm products={products} />
    </div>
  );
}
