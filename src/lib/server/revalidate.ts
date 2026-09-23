import "server-only";
import { revalidatePath } from "next/cache";

/** Storefront pages are statically cached; after any admin write, drop the
    whole cache so home, shop, product pages and the sitemap re-render with
    the new data on their next visit. */
export function revalidateStorefront() {
  revalidatePath("/", "layout");
}

export const isObjectId = (id: string) => /^[a-f0-9]{24}$/.test(id);
