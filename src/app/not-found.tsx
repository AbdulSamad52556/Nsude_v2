import { ShopChrome } from "@/components/layout/ShopChrome";
import { StoreNotFound } from "@/components/layout/StoreNotFound";

export const metadata = { title: "Page not found" };

// Unmatched storefront URLs (and missing products) render under the root
// layout, which has no storefront frame, so this page brings its own.
// Admin has its own 404 inside the admin panel.
export default function NotFound() {
  return (
    <ShopChrome>
      <StoreNotFound />
    </ShopChrome>
  );
}
