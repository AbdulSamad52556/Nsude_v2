import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rateLimit";
import { peekCustomerId } from "@/lib/server/customer";
import { getAdmin } from "@/lib/server/auth";
import {
  describeAgent,
  ensureActivityTtl,
  expiresAt,
  flagUpdate,
  flagsFor,
  isBot,
  maskDigits,
} from "@/lib/server/activity";
import { ID_PATTERN, areaOf } from "@/lib/activity";

const value = z.union([z.string().max(300).transform(maskDigits), z.number().finite(), z.boolean()]);
const pathSchema = z
  .string()
  .max(500)
  .refine((p) => p.startsWith("/"), "path");

const bodySchema = z.object({
  vid: z.string().regex(ID_PATTERN),
  sid: z.string().regex(ID_PATTERN),
  area: z.enum(["store", "admin"]).default("store"),
  /** "Still here" check-in: no events, just keeps the visit current. */
  heartbeat: z.boolean().optional(),
  // Sent with the first batch of a visit.
  ctx: z
    .object({
      landing: pathSchema,
      referrer: z.string().max(500).optional(),
      utmSource: z.string().max(100).optional(),
      utmMedium: z.string().max(100).optional(),
      utmCampaign: z.string().max(100).optional(),
      screen: z.string().max(20).optional(),
      language: z.string().max(20).optional(),
    })
    .optional(),
  events: z
    .array(
      z.object({
        type: z.string().regex(/^[a-z_]{2,40}$/),
        at: z.number().int(),
        path: pathSchema,
        data: z
          .record(z.string().max(40), value)
          .refine((d) => Object.keys(d).length <= 20, "too many fields")
          .optional(),
      })
    )
    .max(50),
});

// Client-only events: anything the server confirms itself (orders, sign-in…)
// is recorded server-side and ignored here, so it can't be faked.
const SERVER_ONLY = new Set([
  "order_placed",
  "payment_completed",
  "signed_in",
  "signed_up",
  "signed_out",
  "profile_updated",
  "address_saved",
  "address_deleted",
  "order_edited",
  "order_cancelled",
  "otp_requested",
  "sign_in_failed",
  "audit",
]);

/**
 * Receives a batch of events — a shopper's on the storefront, or a signed-in
 * admin user's in the admin panel — sent with fetch keepalive or sendBeacon.
 * Always answers 204 so tracking can never break the page.
 */
export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  const ua = request.headers.get("user-agent") ?? "";
  if (isBot(ua)) return done;
  // ~1 batch every few seconds per visitor is normal; this only stops floods.
  if (!rateLimit(request, "track", 120, 60_000)) return done;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return done;
  const { vid, sid, ctx, area } = parsed.data;

  if (parsed.data.heartbeat) {
    // Admin check-ins only count for the signed-in admin's own session.
    const admin = area === "admin" ? await getAdmin() : null;
    if (area === "admin" && !admin) return done;
    // Only an existing, matching visit; a heartbeat never starts one.
    await db.visitSession
      .updateMany({
        where: { key: sid, visitorId: vid, area, ...(admin ? { adminEmail: admin.email } : {}) },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => {});
    return done;
  }

  const events = parsed.data.events.filter((e) => !SERVER_ONLY.has(e.type) && areaOf(e.path) === area);
  if (events.length === 0) return done;

  try {
    void ensureActivityTtl();
    // Admin visits only count for a signed-in admin (the visit itself is
    // started at sign-in); before that, nothing is stored.
    const admin = area === "admin" ? await getAdmin() : null;
    if (area === "admin" && !admin) return done;
    const customerId = area === "store" ? await peekCustomerId() : null;
    const now = Date.now();
    // Browser clocks drift; keep times within the last hour and never ahead.
    const at = (t: number) => new Date(Math.min(now, Math.max(now - 60 * 60 * 1000, t)));

    let visit = await db.visitSession.findUnique({ where: { key: sid } });
    if (visit && (visit.visitorId !== vid || visit.area !== area)) return done;
    if (visit && admin && visit.adminEmail !== admin.email) return done;
    if (!visit) {
      const first = events[0];
      visit = await db.visitSession
        .create({
          data: {
            key: sid,
            visitorId: vid,
            area,
            customerId,
            adminEmail: admin?.email ?? null,
            startedAt: at(first.at),
            lastSeenAt: at(first.at),
            landingPath: ctx?.landing ?? first.path,
            exitPath: first.path,
            orderNumbers: [],
            referrer: ctx?.referrer || null,
            utmSource: ctx?.utmSource || null,
            utmMedium: ctx?.utmMedium || null,
            utmCampaign: ctx?.utmCampaign || null,
            screen: ctx?.screen || null,
            language: ctx?.language || null,
            ...describeAgent(ua),
            expiresAt: expiresAt(),
          },
        })
        // Two first batches racing: the other one created it.
        .catch(() => db.visitSession.findUnique({ where: { key: sid } }));
      if (!visit) return done;
    }

    // Visit started by the server (see recordActivity): add where it came from.
    const fillContext =
      ctx && visit.pageViews === 0
        ? {
            landingPath: ctx.landing,
            referrer: ctx.referrer || null,
            utmSource: ctx.utmSource || null,
            utmMedium: ctx.utmMedium || null,
            utmCampaign: ctx.utmCampaign || null,
            screen: ctx.screen || null,
            language: ctx.language || null,
          }
        : {};

    const owner = customerId ?? visit.customerId;
    await db.activityEvent.createMany({
      data: events.map((e) => ({
        sessionKey: sid,
        visitorId: vid,
        area,
        customerId: owner,
        at: at(e.at),
        type: e.type,
        path: e.path,
        data: e.data ?? undefined,
        expiresAt: expiresAt(),
      })),
    });

    const pageViews = events.filter((e) => e.type === "page_view");
    const flags = events.reduce(
      (acc, e) => ({ ...acc, ...flagsFor(e.type, e.path, e.data ?? null) }),
      {} as ReturnType<typeof flagsFor>
    );
    await db.visitSession.update({
      where: { key: sid },
      data: {
        lastSeenAt: at(events[events.length - 1].at),
        eventCount: { increment: events.length },
        pageViews: { increment: pageViews.length },
        ...(pageViews.length ? { exitPath: pageViews[pageViews.length - 1].path } : {}),
        ...(customerId && !visit.customerId ? { customerId } : {}),
        expiresAt: expiresAt(),
        ...fillContext,
        ...flagUpdate(flags),
      },
    });
  } catch (err) {
    console.error("Tracking batch failed", err);
  }
  return done;
}
