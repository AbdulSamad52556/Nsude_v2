import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { UIProvider } from "@/context/UIContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  style: ["normal", "italic"],
});

const siteUrl = "https://nsude.example.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NSUDE — Premium Menswear",
    template: "%s — NSUDE",
  },
  description:
    "NSUDE is a premium menswear label built on essential T-shirts — considered fits, heavyweight cotton, and quiet confidence.",
  keywords: [
    "NSUDE",
    "premium t-shirts",
    "men's t-shirts",
    "menswear",
    "essential tees",
    "premium menswear India",
  ],
  openGraph: {
    title: "NSUDE — Premium Menswear",
    description:
      "Quiet confidence. Exceptional essentials. Premium men's T-shirts, designed to last.",
    url: siteUrl,
    siteName: "NSUDE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NSUDE — Premium Menswear",
    description: "Quiet confidence. Exceptional essentials.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-ink font-sans antialiased">
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[200] -translate-y-24 bg-ink px-4 py-2 text-xs uppercase tracking-widest2 text-bone transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        {/* Storefront chrome lives in (shop)/layout; the admin panel has
            its own layout under /admin. */}
        <UIProvider>
          <CartProvider>{children}</CartProvider>
        </UIProvider>
      </body>
    </html>
  );
}
