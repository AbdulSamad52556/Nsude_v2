import "server-only";
import { cookies, headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { ID_PATTERN, VISIT_COOKIE, VISITOR_COOKIE } from "@/lib/activity";

// Storefront activity: visits (VisitSession) and what happened in them
// (ActivityEvent). The browser sends batches to /api/track; the server adds
// the events it can confirm itself (order placed, paid, signed in…).
// Nothing typed into a form is ever stored.

const RETENTION_DAYS = Math.max(1, Number(process.env.ACTIVITY_RETENTION_DAYS) || 180);
export const expiresAt = () => new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

// MongoDB deletes rows once `expiresAt` passes. Created here rather than in
// the Prisma schema because Prisma can't declare TTL indexes. `prisma db
// push` drops indexes it doesn't know, so this re-checks every hour;
// creating an index that exists is a no-op.
const TTL_CHECK_MS = 60 * 60 * 1000;
let ttlReady: Promise<void> | null = null;
let ttlCheckedAt = 0;
export function ensureActivityTtl() {
  if (Date.now() - ttlCheckedAt > TTL_CHECK_MS) {
    ttlCheckedAt = Date.now();
    ttlReady = null;
  }
  ttlReady ??= (async () => {
    for (const collection of ["VisitSession", "ActivityEvent"]) {
      await db.$runCommandRaw({
        createIndexes: collection,
        indexes: [{ key: { expiresAt: 1 }, name: "ttl_expiresAt", expireAfterSeconds: 0 }],
      });
    }
  })().catch((err) => {
    ttlReady = null; // try again on the next request
    console.error("Creating activity TTL indexes failed", err);
  });
  return ttlReady;
}

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|curl|wget|python-requests/i;
export const isBot = (ua: string) => !ua || BOT.test(ua);

/** Rough device / browser / OS from the user agent — enough for a glance. */
export function describeAgent(ua: string) {
  const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua)
    ? "tablet"
    : /Mobi|iPhone|Android/i.test(ua)
      ? "mobile"
      : "desktop";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /CriOS|Chrome\//.test(ua)
          ? "Chrome"
          : /FxiOS|Firefox\//.test(ua)
            ? "Firefox"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Other";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Other";
  return { device, browser, os };
}

/** Long digit runs (phone numbers, codes) never reach the log. */
export const maskDigits = (s: string) => s.replace(/\d[\d\s-]{5,}\d/g, "••••");

type Flags = { addedToBag?: boolean; reachedCheckout?: boolean; orderNumber?: string };
export function flagsFor(type: string, path: string, data: Record<string, unknown> | null): Flags {
  const flags: Flags = {};
  if (type === "add_to_bag" || type === "buy_now") flags.addedToBag = true;
  if (type === "page_view" && path.startsWith("/checkout")) flags.reachedCheckout = true;
  if (type === "order_placed" && typeof data?.order === "string") flags.orderNumber = data.order;
  return flags;
}

export function flagUpdate(flags: Flags): Prisma.VisitSessionUpdateInput {
  return {
    ...(flags.addedToBag ? { addedToBag: true } : {}),
    ...(flags.reachedCheckout ? { reachedCheckout: true } : {}),
    ...(flags.orderNumber ? { orderNumbers: { push: flags.orderNumber } } : {}),
  };
}

/**
 * Records an event the server itself confirmed (e.g. an order was saved),
 * against the visit in the request's cookies. Does nothing without a visit
 * (tracking blocked, bots, API clients). Never throws.
 */
export async function recordActivity(
  type: string,
  data: Record<string, string | number | boolean> = {},
  opts: { customerId?: string | null; path?: string } = {}
) {
  try {
    const store = cookies();
    const sessionKey = store.get(VISIT_COOKIE)?.value;
    const visitorId = store.get(VISITOR_COOKIE)?.value;
    if (!sessionKey || !visitorId || !ID_PATTERN.test(sessionKey) || !ID_PATTERN.test(visitorId)) return;
    const path = opts.path ?? new URL(headers().get("referer") ?? "http://x/").pathname;
    // The server can act before the browser's first batch arrives (e.g. a
    // code requested in the first seconds): start the visit here; the batch
    // fills in where it came from.
    const ua = headers().get("user-agent") ?? "";
    const visit =
      (await db.visitSession.findUnique({ where: { key: sessionKey } })) ??
      (isBot(ua)
        ? null
        : await db.visitSession
            .create({
              data: {
                key: sessionKey,
                visitorId,
                customerId: opts.customerId ?? null,
                landingPath: path,
                exitPath: path,
                orderNumbers: [],
                ...describeAgent(ua),
                expiresAt: expiresAt(),
              },
            })
            .catch(() => db.visitSession.findUnique({ where: { key: sessionKey } })));
    if (!visit || visit.visitorId !== visitorId) return;

    const customerId = opts.customerId ?? visit.customerId ?? null;
    await db.activityEvent.create({
      data: { sessionKey, visitorId, customerId, type, path, data, source: "server", expiresAt: expiresAt() },
    });
    await db.visitSession.update({
      where: { key: sessionKey },
      data: {
        lastSeenAt: new Date(),
        eventCount: { increment: 1 },
        ...(customerId && !visit.customerId ? { customerId } : {}),
        ...flagUpdate(flagsFor(type, path, data)),
      },
    });
  } catch (err) {
    console.error("Recording activity failed", err);
  }
}

/**
 * On sign-in: this browser's earlier visits and events (as a guest) now
 * belong to the customer, so their history runs from first entry.
 */
export async function linkVisitorToCustomer(customerId: string) {
  try {
    const visitorId = cookies().get(VISITOR_COOKIE)?.value;
    if (!visitorId || !ID_PATTERN.test(visitorId)) return;
    await db.visitSession.updateMany({ where: { visitorId, customerId: null }, data: { customerId } });
    await db.activityEvent.updateMany({ where: { visitorId, customerId: null }, data: { customerId } });
  } catch (err) {
    console.error("Linking activity to customer failed", err);
  }
}
