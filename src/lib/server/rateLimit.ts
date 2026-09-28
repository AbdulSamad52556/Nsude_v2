import "server-only";
import type { NextRequest } from "next/server";

// Fixed-window, per-IP limiter held in memory. Enough to stop a script from
// hammering public endpoints on one server; for several instances, move the
// counters to a shared store (e.g. Redis).
const buckets = new Map<string, { count: number; start: number }>();

export function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.ip || "unknown";
}

/** True if this request is allowed; counts it against `name`'s limit. */
export function rateLimit(request: NextRequest, name: string, limit: number, windowMs: number) {
  const key = `${name}:${clientIp(request)}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    buckets.set(key, { count: 1, start: now });
    if (buckets.size > 10_000) {
      for (const [k, b] of Array.from(buckets)) if (now - b.start > windowMs) buckets.delete(k);
    }
    return true;
  }
  bucket.count++;
  return bucket.count <= limit;
}
