"use client";

// Browser side of activity tracking, for shoppers on the storefront and admin
// users in the admin panel (separate visits). `track()` queues an event;
// batches go to /api/track every few seconds, and on leaving the page via
// sendBeacon so the last steps of a visit aren't lost. Never records what's
// typed into forms.

import {
  HEARTBEAT_MINUTES,
  ID_PATTERN,
  VISITOR_COOKIE,
  areaOf,
  visitCookie,
  visitIdleMinutes,
  type ActivityArea,
} from "@/lib/activity";

type Value = string | number | boolean;
type Event = { type: string; at: number; path: string; data?: Record<string, Value> };

const ENDPOINT = "/api/track";
const FLUSH_MS = 4000;
const MAX_BATCH = 40;

let queue: Event[] = [];
// When this page last told the server anything (an event or a check-in).
let lastContact = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
// Where a new visit came from, per area, sent with its first batch.
const pendingCtx: Partial<Record<ActivityArea, Record<string, string>>> = {};

function readCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Visitor id (1 year) and visit id (slides 30 minutes on every event). */
function ids(area: ActivityArea) {
  let vid = readCookie(VISITOR_COOKIE);
  if (!vid || !ID_PATTERN.test(vid)) vid = newId();
  writeCookie(VISITOR_COOKIE, vid, 365 * 24 * 60 * 60);

  let sid = readCookie(visitCookie(area));
  if (!sid || !ID_PATTERN.test(sid)) {
    sid = newId();
    pendingCtx[area] = visitContext();
  }
  writeCookie(visitCookie(area), sid, visitIdleMinutes(area) * 60);
  return { vid, sid };
}

/** Where the visit came from, sent once when it starts. */
function visitContext() {
  const params = new URLSearchParams(location.search);
  const ref = document.referrer;
  const external = ref && !ref.startsWith(location.origin);
  const ctx: Record<string, string> = {
    landing: location.pathname,
    screen: `${screen.width}x${screen.height}`,
    language: navigator.language?.slice(0, 20) ?? "",
  };
  if (external) ctx.referrer = ref.slice(0, 500);
  for (const [param, key] of [
    ["utm_source", "utmSource"],
    ["utm_medium", "utmMedium"],
    ["utm_campaign", "utmCampaign"],
  ] as const) {
    const v = params.get(param);
    if (v) ctx[key] = v.slice(0, 100);
  }
  return ctx;
}

function send(useBeacon: boolean) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  // One area per batch (a page is either storefront or admin).
  const area = areaOf(queue[0].path);
  const { vid, sid } = ids(area);
  const batch: Event[] = [];
  while (batch.length < MAX_BATCH && queue.length && areaOf(queue[0].path) === area) batch.push(queue.shift()!);
  const ctx = pendingCtx[area];
  delete pendingCtx[area];
  const body = JSON.stringify({ vid, sid, area, ...(ctx ? { ctx } : {}), events: batch });
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    } else {
      fetch(ENDPOINT, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(
        () => {}
      );
    }
  } catch {
    // tracking must never break the page
  }
  if (queue.length > 0) send(useBeacon);
}

/** Records something the visitor did (on `path`, default the current page). */
export function track(type: string, data?: Record<string, Value | null | undefined>, path?: string) {
  if (typeof window === "undefined") return;
  const where = path ?? location.pathname + location.search;
  const clean: Record<string, Value> = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    if (v === null || v === undefined || v === "") continue;
    clean[k] = typeof v === "string" ? v.slice(0, 300) : v;
  }
  queue.push({
    type,
    at: Date.now(),
    path: where,
    ...(Object.keys(clean).length ? { data: clean } : {}),
  });
  ids(areaOf(where)); // keep the visit alive
  lastContact = Date.now();
  if (queue.length >= MAX_BATCH) send(false);
  else timer ??= setTimeout(() => send(false), FLUSH_MS);
}

/**
 * "Still here": called every minute while a page is open, it tells the server
 * once every 5 minutes that the tab is open and on screen — only when nothing
 * else (a click, a page) was sent in that time. Shoppers and admin users
 * alike. It doesn't add to the timeline; the server only moves the visit's
 * "last seen", which is what "Active now" reads.
 */
export function heartbeat() {
  if (typeof window === "undefined" || document.visibilityState !== "visible") return;
  if (Date.now() - lastContact < HEARTBEAT_MINUTES * 60 * 1000) return;
  const area = areaOf(location.pathname);
  // Visit already over (away too long): this starts a new one properly.
  if (!readCookie(visitCookie(area))) {
    track("page_view", { title: document.title.replace(/ — NSUDE( Admin)?$/, ""), resumed: true });
    return;
  }
  const { vid, sid } = ids(area);
  lastContact = Date.now();
  fetch(ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ vid, sid, area, heartbeat: true, events: [] }),
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {});
}

/** Sends whatever is queued right away (page hidden / closing). */
export function flushTracking() {
  send(true);
}
