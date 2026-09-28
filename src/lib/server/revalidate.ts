import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

// Kept in sync with LISTINGS_TAG in ./listings (not imported, to avoid a
// cycle: listings → products → … → revalidate).
const LISTINGS_TAG = "listings";

/** Storefront pages and the cached shop/search results are reused until
    the catalog changes; after any admin write, drop them all so home, shop,
    product pages, search and the sitemap show the new data next visit. */
export function revalidateStorefront() {
  revalidateTag(LISTINGS_TAG);
  revalidatePath("/", "layout");
}

export const isObjectId = (id: string) => /^[a-f0-9]{24}$/.test(id);
