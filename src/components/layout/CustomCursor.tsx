"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * Small dot that replaces the mouse pointer, growing into a labelled circle
 * over elements with `data-cursor` (e.g. "View" on product photos).
 *
 * It follows the mouse exactly — positioned straight from each mousemove,
 * with no easing or React render — so it never trails behind. Only the
 * size / label change goes through React, and only when it actually changes.
 */
export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState("");
  const [visible, setVisible] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const dot = useRef<HTMLDivElement>(null);
  const labelRef = useRef("");
  const visibleRef = useRef(false);

  useEffect(() => {
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!isFinePointer || shouldReduceMotion) return;
    setEnabled(true);
    document.documentElement.classList.add("custom-cursor-active");

    function handleMove(e: MouseEvent) {
      const el = dot.current;
      if (el) el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      if (!visibleRef.current) {
        visibleRef.current = true;
        setVisible(true);
      }
      const next = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-cursor]")?.dataset.cursor ?? "";
      if (next !== labelRef.current) {
        labelRef.current = next;
        setLabel(next);
      }
    }
    function handleLeave() {
      visibleRef.current = false;
      setVisible(false);
    }

    window.addEventListener("mousemove", handleMove, { passive: true });
    document.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
      document.documentElement.classList.remove("custom-cursor-active");
    };
  }, [shouldReduceMotion]);

  if (!enabled) return null;

  const size = label ? 84 : 10;
  return (
    <div
      ref={dot}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[90] mix-blend-difference will-change-transform"
      style={{ transform: "translate3d(-100px, -100px, 0)" }}
    >
      {/* Size and fade animate here, separate from the position above, so
          moving the mouse never waits on a transition. */}
      <div
        className="flex items-center justify-center rounded-full bg-paper"
        style={{
          width: size,
          height: size,
          opacity: visible ? 1 : 0,
          transition: "width 300ms cubic-bezier(0.16,1,0.3,1), height 300ms cubic-bezier(0.16,1,0.3,1), opacity 200ms ease",
        }}
      >
        {label && <span className="text-[10px] font-medium uppercase tracking-widest2 text-ink">{label}</span>}
      </div>
    </div>
  );
}
