"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useUI } from "@/context/UIContext";

export function Preloader() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const { markIntroReady } = useUI();

  useEffect(() => {
    setMounted(true);
    setVisible(true);
    document.body.style.overflow = "hidden";

    const timer = setTimeout(
      () => {
        setVisible(false);
        document.body.style.overflow = "";
        // Start page entrance animations as the preloader begins to fade,
        // so they play in view instead of behind it.
        markIntroReady();
      },
      shouldReduceMotion ? 200 : 2600
    );

    return () => clearTimeout(timer);
  }, [shouldReduceMotion, markIntroReady]);

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              src="/brand/nsude-logo-light.png"
              alt="NSUDE"
              width={482}
              height={172}
              priority
              className="h-8 w-auto"
            />
          </motion.div>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="mt-3 text-[11px] uppercase tracking-widest2 text-stone"
          >
            Est. 2024 / Premium Menswear
          </motion.span>
          <motion.div
            className="mt-10 h-px w-24 overflow-hidden bg-graphite"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.div
              className="h-full w-full origin-left bg-bone"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.5, duration: 1.9, ease: [0.16, 1, 0.3, 1] }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
