import "server-only";
import type { ActivityEvent } from "@prisma/client";
import { formatPrice } from "@/lib/utils";

// Formatting for the admin Activity pages.

export const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
] as const;
export type RangeKey = (typeof RANGES)[number]["key"];

/** Start of the range, in India time for "today". */
export function rangeStart(range: RangeKey) {
  const now = Date.now();
  if (range === "all") return new Date(0);
  if (range === "7d") return new Date(now - 7 * 864e5);
  if (range === "30d") return new Date(now - 30 * 864e5);
  const IST = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now + IST);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST);
}

/** 75 → "1m 15s", 4000 → "1h 6m". */
export function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** "7:50 pm" today, "5 Oct, 7:50 pm" before that (India time). */
export function whenShort(d: Date) {
  const opts = { timeZone: "Asia/Kolkata" } as const;
  const time = d.toLocaleTimeString("en-IN", { ...opts, hour: "numeric", minute: "2-digit" });
  const day = (x: Date) => x.toLocaleDateString("en-IN", opts);
  return day(d) === day(new Date()) ? time : `${d.toLocaleDateString("en-IN", { ...opts, day: "numeric", month: "short" })}, ${time}`;
}

export const timeIST = (d: Date) =>
  d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" });

/** Where the visit came from. */
export function describeSource(v: { referrer: string | null; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null }) {
  if (v.utmSource) return [v.utmSource, v.utmMedium, v.utmCampaign].filter(Boolean).join(" · ");
  if (v.referrer) {
    try {
      return new URL(v.referrer).hostname.replace(/^www\./, "");
    } catch {
      return v.referrer.slice(0, 40);
    }
  }
  return "Direct";
}

type Data = Record<string, string | number | boolean>;
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const money = (v: unknown) => (typeof v === "number" ? formatPrice(v) : "");
const join = (...parts: string[]) => parts.filter(Boolean).join(" · ");

/** One line explaining an event, e.g. "Heavy Tee · Black · M × 1 · ₹1,799". */
export function describeEvent(e: Pick<ActivityEvent, "type" | "path" | "data">) {
  const d = (e.data ?? {}) as Data;
  switch (e.type) {
    case "page_view":
      return join(str(d.title), e.path);
    case "page_leave":
      return join(
        `${formatDuration(Number(d.seconds) * 1000)} on ${e.path}`,
        d.scrolled !== undefined ? `scrolled ${d.scrolled}%` : "",
        d.hidden ? "switched away / closed the tab" : ""
      );
    case "click":
      return join(`“${str(d.label)}”`, d.to ? `→ ${d.to}` : "", d.outbound ? "left the site" : "");
    case "product_view":
      return join(str(d.product), str(d.color), money(d.price), d.inStock === false ? "sold out" : "");
    case "size_select":
      return join(str(d.product), `size ${str(d.size)}`);
    case "quantity_change":
      return join(str(d.product), `quantity ${str(d.quantity)}`);
    case "add_to_bag":
    case "buy_now":
      return join(str(d.product), str(d.color), `${str(d.size)} × ${str(d.quantity)}`, money(d.price));
    case "remove_from_bag":
      return join(str(d.product), `${str(d.size)} × ${str(d.quantity)}`);
    case "bag_quantity":
      return join(str(d.product), str(d.size), `${str(d.from)} → ${str(d.to)}`);
    case "bag_open":
      return `${str(d.items)} item${d.items === 1 ? "" : "s"} in the bag`;
    case "search":
      return `“${str(d.query)}” · ${str(d.results)} result${d.results === 1 ? "" : "s"}`;
    case "shop_filter":
      return d.filters === "none"
        ? `Cleared filters · ${str(d.results)} products`
        : `${decodeURIComponent(str(d.filters)).replace(/&/g, " · ").replace(/=/g, ": ")} · ${str(d.results)} products`;
    case "checkout_step":
      return `${str(d.completed)} done → ${str(d.next)}`;
    case "payment_method":
      return d.method === "cod" ? "Cash on delivery" : "Online payment";
    case "order_placed":
      return join(str(d.order), money(d.total), `${str(d.items)} item${d.items === 1 ? "" : "s"}`, d.payment === "cod" ? "COD" : "Online");
    case "payment_completed":
      return join(str(d.order), money(d.total));
    case "order_edited":
      return join(str(d.order), `changed ${str(d.change)}`);
    case "payment_cancelled":
    case "order_cancelled":
      return str(d.order);
    case "audit":
      return join(str(d.action), str(d.entity), d.fields ? `${d.fields} field${d.fields === 1 ? "" : "s"} changed` : "");
    case "signed_in":
      return d.role ? `as ${str(d.role)}` : "";
    case "address_saved":
      return d.madeDefault ? "Made default" : d.edited ? "Edited" : "New address";
    default:
      return Object.entries(d)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ");
  }
}
