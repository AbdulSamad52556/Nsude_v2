"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { X, Instagram } from "lucide-react";
import { useEffect } from "react";

const links = [
  { label: "Shop", href: "/shop" },
  { label: "Collection", href: "/#collection" },
  { label: "About", href: "/about" },
  { label: "Account", href: "/account" },
];

export function MobileMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="fixed inset-0 z-[95] flex flex-col bg-ink px-6 pb-10 pt-6 text-bone md:hidden"
          initial={{ clipPath: "inset(0 0 100% 0)" }}
          animate={{ clipPath: "inset(0 0 0% 0)" }}
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center justify-between">
            <Image src="/brand/nsude-logo-light.png" alt="NSUDE" width={482} height={172} className="h-6 w-auto" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="text-bone"
            >
              <X size={24} strokeWidth={1.5} />
            </button>
          </div>

          <nav className="mt-16 flex flex-1 flex-col justify-center gap-2">
            {links.map((link, i) => (
              <motion.div
                key={link.label}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={link.href}
                  onClick={onClose}
                  className="block py-3 text-display-md font-medium uppercase leading-none tracking-tighter"
                >
                  {link.label}
                </Link>
              </motion.div>
            ))}
          </nav>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex items-center justify-between border-t border-graphite pt-6 text-xs uppercase tracking-widest2 text-stone"
          >
            <span>Est. 2024</span>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              aria-label="NSUDE on Instagram"
              className="flex items-center gap-2 text-bone"
            >
              <Instagram size={16} strokeWidth={1.5} /> Instagram
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
