"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { flushTracking, track } from "@/lib/track";

const CLICKABLE = "a, button, [role=button], [role=tab], [role=switch], [role=radio], [role=option], summary";

/** What a clicked element is called, without anything the visitor typed. */
function labelOf(el: Element) {
  const text =
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    (el instanceof HTMLElement ? el.innerText : el.textContent) ||
    el.querySelector("img")?.getAttribute("alt") ||
    "";
  return text.replace(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * Tracks the whole visit (storefront, or admin panel for admin users): every page (with time spent and how
 * far it was scrolled), every click on a link or button, and the moment the
 * visitor leaves. Specific actions (add to bag, size picked…) are tracked
 * where they happen with `track()`.
 */
export function ActivityTracker() {
  const pathname = usePathname();
  const page = useRef<{ path: string; start: number; scroll: number } | null>(null);

  // Page views, and "left page" for the previous one. Keyed on the path only:
  // shop filters change the query string in place and are tracked as
  // "shop_filter" instead of a new page each time.
  useEffect(() => {
    const prev = page.current;
    if (prev && prev.path.split("?")[0] === pathname) return;
    if (prev) leave(prev);
    page.current = { path: pathname + location.search, start: Date.now(), scroll: 0 };
    // Wait a tick so the new page's <title> is in place. (Not cancelled on
    // cleanup: the page is already recorded as current, so a re-run skips.)
    const path = page.current.path;
    setTimeout(() => track("page_view", { title: document.title.replace(/ — NSUDE( Admin)?$/, "") }, path), 50);
  }, [pathname]);

  // Scroll depth, clicks, and leaving (tab hidden, closed, or navigated away).
  useEffect(() => {
    const onScroll = () => {
      if (!page.current) return;
      const max = document.documentElement.scrollHeight - innerHeight;
      const pct = max > 0 ? Math.round((scrollY / max) * 100) : 100;
      if (pct > page.current.scroll) page.current.scroll = Math.min(100, pct);
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.(CLICKABLE);
      if (!el || el.closest("[data-track-ignore]")) return;
      const href = el instanceof HTMLAnchorElement ? el.href : "";
      const sameSite = href.startsWith(location.origin);
      track("click", {
        label: labelOf(el) || el.tagName.toLowerCase(),
        to: href ? (sameSite ? href.slice(location.origin.length) : href) : undefined,
        outbound: href && !sameSite ? true : undefined,
      });
    };
    const onHide = () => {
      if (document.visibilityState === "hidden" && page.current) {
        leave(page.current, true);
        // Coming back starts the clock again on the same page.
        page.current = { ...page.current, start: Date.now() };
      }
    };
    const onPageHide = () => flushTracking();

    addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("visibilitychange", onHide);
    addEventListener("pagehide", onPageHide);
    return () => {
      removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onHide);
      removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}

function leave(p: { path: string; start: number; scroll: number }, hidden = false) {
  track(
    "page_leave",
    { seconds: Math.round((Date.now() - p.start) / 1000), scrolled: p.scroll, hidden: hidden || undefined },
    p.path
  );
  if (hidden) flushTracking();
}
