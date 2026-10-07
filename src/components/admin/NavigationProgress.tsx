"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin bar across the top of the content while an admin page loads (black;
 * sand on phones, over the black header). Starts on any click on an in-app
 * link, creeps towards the end, then fills and fades once the new page shows.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const loading = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const creep = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (creep.current) clearInterval(creep.current);
    creep.current = null;
  };

  // Start: a plain left-click on a link to another page of this site.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      clearAll();
      loading.current = true;
      setVisible(true);
      setWidth(8);
      // Ease towards 90% until the page arrives.
      creep.current = setInterval(() => setWidth((w) => w + (90 - w) * 0.12), 200);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      clearAll();
    };
  }, []);

  // Finish: the new page is on screen — fill, fade, then reset unseen. While
  // the loading skeleton (admin loading.tsx) is still showing, keep going.
  useEffect(() => {
    if (!loading.current) return;
    const finish = () => {
      loading.current = false;
      clearAll();
      setWidth(100);
      timers.current.push(setTimeout(() => setVisible(false), 250));
      timers.current.push(setTimeout(() => setWidth(0), 600));
    };
    const skeleton = () => document.querySelector("main [aria-busy='true']");
    if (!skeleton()) return finish();
    const observer = new MutationObserver(() => {
      if (!skeleton()) {
        observer.disconnect();
        finish();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname, search]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 right-0 top-0 z-[60] h-[3px] md:left-60"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms ease" }}
    >
      <div
        className="h-full bg-sand md:bg-ink md:shadow-[0_0_8px_rgba(0,0,0,0.5)]"
        style={{ width: `${width}%`, transition: width === 0 ? "none" : "width 200ms ease-out" }}
      />
    </div>
  );
}
