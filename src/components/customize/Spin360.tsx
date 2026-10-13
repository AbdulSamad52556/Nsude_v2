"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { cx } from "@/lib/utils";

const STEP = 90; // degrees between views
const DRAG = 0.5; // degrees per pixel dragged
const AUTO_PAUSE = 1800; // ms each view stays before turning

/**
 * "360°" turn through a few photographed views (front, side, back, side):
 * neighbouring views cross over with a 3D turn as the angle moves. Drag or
 * swipe to spin; it turns on its own until touched.
 */
export function Spin360({ faces, labels }: { faces: React.ReactNode[]; labels: string[] }) {
  const n = faces.length;
  const reduceMotion = useReducedMotion();
  const angle = useMotionValue(0);
  const [deg, setDeg] = useState(0);
  useMotionValueEvent(angle, "change", setDeg);
  const [auto, setAuto] = useState(!reduceMotion && n > 1);
  const drag = useRef<{ x: number; start: number } | null>(null);

  const current = ((Math.round(deg / STEP) % n) + n) % n;

  function goTo(target: number) {
    animate(angle, target, reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 });
  }

  // Turn by itself, one view at a time, until the customer takes over.
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => goTo(Math.round(angle.get() / STEP) * STEP + STEP), AUTO_PAUSE);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  function onDown(e: React.PointerEvent) {
    if (n < 2) return;
    setAuto(false);
    angle.stop();
    try {
      e.currentTarget.setPointerCapture(e.pointerId); // keep turning if the finger leaves the photo
    } catch {
      // Not every pointer can be captured; dragging still works without it.
    }
    drag.current = { x: e.clientX, start: angle.get() };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    angle.set(drag.current.start - (e.clientX - drag.current.x) * DRAG);
  }
  function onUp() {
    if (!drag.current) return;
    drag.current = null;
    goTo(Math.round(angle.get() / STEP) * STEP); // settle on the nearest view
  }

  /** Go to view i the short way round. */
  function jump(i: number) {
    setAuto(false);
    const now = angle.get();
    const base = Math.round(now / STEP) * STEP;
    let diff = (i - current) % n;
    if (diff > n / 2) diff -= n;
    if (diff < -n / 2) diff += n;
    goTo(base + diff * STEP);
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className={cx(
          "relative aspect-[4/5] w-full touch-none select-none",
          n > 1 && "cursor-grab active:cursor-grabbing",
        )}
        style={{ perspective: 1400 }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {faces.map((face, i) => {
          // Where this view sits relative to the camera, in (-180, 180].
          let rel = (((i * STEP - deg) % 360) + 360) % 360;
          if (rel > 180) rel -= 360;
          const t = Math.min(1, Math.abs(rel) / STEP); // 0 = facing us, 1 = turned away
          // Views turned away stay mounted (invisible) so their photos are
          // already loaded when they come round.
          return (
            <div
              key={i}
              className="absolute inset-0 overflow-hidden rounded-md bg-bone"
              aria-hidden={i !== current}
              style={{
                opacity: n > 1 ? 1 - t : 1,
                pointerEvents: "none",
                zIndex: Math.round((1 - t) * 10),
                transform: `translateX(${(rel / STEP) * 30}%) rotateY(${rel * 0.7}deg) scale(${1 - t * 0.12})`,
              }}
            >
              {face}
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <div className="mt-4 flex items-center gap-1 rounded-md border border-taupe/50 p-0.5">
          {labels.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => jump(i)}
              aria-pressed={i === current}
              className={cx(
                "rounded px-3 py-1.5 text-[11px] uppercase tracking-widest2 transition-colors",
                i === current ? "bg-ink text-paper" : "text-graphite hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
