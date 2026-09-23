import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Preloader } from "@/components/layout/Preloader";
import { CustomCursor } from "@/components/layout/CustomCursor";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { SearchOverlay } from "@/components/search/SearchOverlay";

/** Storefront frame: header, footer, cart, search, preloader and cursor.
    Used by the (shop) layout and the root 404 page; the admin panel has
    its own frame. */
export function ShopChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CustomCursor />
      <Preloader />
      <Navbar />
      <div className="relative mx-auto max-w-[1440px] overflow-x-clip bg-paper">
        <main id="main-content">{children}</main>
        <Footer />
      </div>
      <CartDrawer />
      <SearchOverlay />
    </>
  );
}
