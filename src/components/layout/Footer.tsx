import Link from "next/link";
import Image from "next/image";
import { Instagram, Youtube, Twitter } from "lucide-react";
import { Newsletter } from "@/components/ui/Newsletter";

const columns = [
  {
    title: "Shop",
    links: [
      { label: "All T-Shirts", href: "/shop" },
      { label: "New Arrivals", href: "/shop?sort=newest" },
      { label: "Collection", href: "/#collection" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Shipping", href: "/shipping" },
      { label: "Returns", href: "/returns" },
      { label: "Size Guide", href: "/shop" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-ink text-bone">
      <div className="mx-auto max-w-content px-5 pb-10 pt-20 md:px-10">
        <div className="grid grid-cols-1 gap-16 border-b border-graphite pb-16 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="flex flex-col justify-between gap-10">
            <div className="w-fit">
              <Image
                src="/brand/nsude-logo-light.png"
                alt="NSUDE"
                width={482}
                height={172}
                className="h-6 w-auto md:h-7"
              />
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-mist">
              Quiet confidence. Exceptional essentials. Premium menswear,
              designed to disappear into your wardrobe and built to last.
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="mb-5 text-xs uppercase tracking-widest2 text-stone">
                {col.title}
              </h3>
              <ul className="flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm uppercase tracking-wide text-mist transition-colors hover:text-bone"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <Newsletter />
        </div>

        <div className="flex flex-col-reverse items-center justify-between gap-6 pt-8 text-xs uppercase tracking-wide text-stone md:flex-row">
          <p>© 2026 NSUDE. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-bone">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-bone">
              Terms
            </Link>
            <Link href="/shipping" className="hover:text-bone">
              Shipping &amp; Returns
            </Link>
          </div>
          <div className="flex items-center gap-4 text-bone">
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
              <Instagram size={16} strokeWidth={1.5} />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube">
              <Youtube size={16} strokeWidth={1.5} />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter">
              <Twitter size={16} strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
