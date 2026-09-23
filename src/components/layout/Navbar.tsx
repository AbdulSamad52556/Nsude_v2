"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Search, User, ShoppingBag, Menu } from "lucide-react";
import { cx } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import { useUI } from "@/context/UIContext";
import { MobileMenu } from "./MobileMenu";

const links = [
  { label: "Shop", href: "/shop" },
  { label: "Collection", href: "/#collection" },
  { label: "About", href: "/about" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastScrollY = useRef(0);
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const { count, openCart } = useCart();
  const { openSearch } = useUI();

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    function onScroll() {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;

      // On the home page the hero stays dark until it has fully scrolled
      // past, rather than switching the header white almost immediately.
      const hero = pathname === "/" ? document.getElementById("home-hero") : null;
      setScrolled(hero ? hero.getBoundingClientRect().bottom <= 0 : currentY > 24);

      if (currentY < 80) {
        setHidden(false);
      } else if (Math.abs(delta) > 4) {
        setHidden(delta > 0);
      }

      lastScrollY.current = currentY;
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) setHidden(false);
  }, [mobileOpen]);

  const tone = scrolled ? "text-ink" : "text-bone";

  return (
    <>
      <motion.header
        animate={{ y: hidden ? "-100%" : "0%" }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={cx(
          "fixed inset-x-0 top-0 z-50 mx-auto w-full max-w-[1440px] transition-[padding,background-color,border-color] duration-500 ease-editorial",
          scrolled
            ? "border-b border-graphite/10 bg-paper/90 py-3 backdrop-blur-md"
            : "border-b border-transparent bg-transparent py-6"
        )}
      >
        <nav
          className="mx-auto flex max-w-content items-center justify-between px-5 md:px-10"
          aria-label="Main navigation"
        >
          <Link href="/" aria-label="NSUDE, home" data-cursor="">
            <Image
              src={scrolled ? "/brand/nsude-logo-dark.png" : "/brand/nsude-logo-light.png"}
              alt="NSUDE"
              width={482}
              height={172}
              priority
              className="h-6 w-auto transition-opacity duration-500 ease-editorial md:h-7"
            />
          </Link>

          <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 md:flex">
            {links.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className={cx(
                    "group relative text-xs uppercase tracking-widest2 transition-colors duration-500",
                    tone
                  )}
                >
                  {link.label}
                  <span
                    className={cx(
                      "absolute -bottom-1 left-0 h-px w-0 transition-all duration-300 ease-editorial group-hover:w-full",
                      scrolled ? "bg-ink" : "bg-bone"
                    )}
                  />
                </Link>
              </li>
            ))}
          </ul>

          <div className={cx("flex items-center gap-5 transition-colors duration-500", tone)}>
            <button
              type="button"
              onClick={openSearch}
              aria-label="Search"
              className="hidden transition-opacity hover:opacity-60 md:inline-flex"
            >
              <Search size={19} strokeWidth={1.5} />
            </button>
            <Link
              href="/account"
              aria-label="Account"
              className="hidden transition-opacity hover:opacity-60 md:inline-flex"
            >
              <User size={19} strokeWidth={1.5} />
            </Link>
            <button
              type="button"
              onClick={openCart}
              aria-label={`Open bag, ${count} items`}
              className="flex items-center gap-1.5 transition-opacity hover:opacity-60"
            >
              <ShoppingBag size={19} strokeWidth={1.5} />
              <span className="text-xs tracking-wide">({count})</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="inline-flex md:hidden"
            >
              <Menu size={22} strokeWidth={1.5} />
            </button>
          </div>
        </nav>
      </motion.header>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
