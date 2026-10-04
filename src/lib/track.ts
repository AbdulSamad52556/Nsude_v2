"use client";

// Browser side of activity tracking. `track()` queues an event; batches go to
// /api/track every few seconds, and on leaving the page via sendBeacon so the
// last steps of a visit aren't lost. Never records what's typed into forms.

import { ID_PATTERN, VISIT_COOKIE, VISIT_IDLE_MINUTES, VISITOR_COOKIE } from "@/lib/activity";

type Value = string | number | boolean;
type Event = { type: string; at: number; path: string; data?: Record<string, Value> };

const ENDPOINT = "/api/track";
const FLUSH_MS = 4000;
const MAX_BATCH = 40;

let queue: Event[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let pendingCtx: Record<string, string> | null = null;

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
function ids() {
  let vid = readCookie(VISITOR_COOKIE);
  if (!vid || !ID_PATTERN.test(vid)) vid = newId();
  writeCookie(VISITOR_COOKIE, vid, 365 * 24 * 60 * 60);

  let sid = readCookie(VISIT_COOKIE);
  if (!sid || !ID_PATTERN.test(sid)) {
    sid = newId();
    pendingCtx = visitContext();
  }
  writeCookie(VISIT_COOKIE, sid, VISIT_IDLE_MINUTES * 60);
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
  const { vid, sid } = ids();
  const batch = queue.splice(0, MAX_BATCH);
  const body = JSON.stringify({ vid, sid, ...(pendingCtx ? { ctx: pendingCtx } : {}), events: batch });
  pendingCtx = null;
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

/** Records something the visitor did on the storefront (on `path`, default the current page). */
export function track(type: string, data?: Record<string, Value | null | undefined>, path?: string) {
  if (typeof window === "undefined" || location.pathname.startsWith("/admin")) return;
  const clean: Record<string, Value> = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    if (v === null || v === undefined || v === "") continue;
    clean[k] = typeof v === "string" ? v.slice(0, 300) : v;
  }
  queue.push({
    type,
    at: Date.now(),
    path: path ?? location.pathname + location.search,
    ...(Object.keys(clean).length ? { data: clean } : {}),
  });
  ids(); // keep the visit alive
  if (queue.length >= MAX_BATCH) send(false);
  else timer ??= setTimeout(() => send(false), FLUSH_MS);
}

/** Sends whatever is queued right away (page hidden / closing). */
export function flushTracking() {
  send(true);
}
