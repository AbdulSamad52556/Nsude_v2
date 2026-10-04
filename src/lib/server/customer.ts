import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Customer } from "@prisma/client";
import { db } from "./db";
import type { AccountData } from "@/lib/account";
import { OTP_LENGTH } from "@/lib/account";

// Customer sessions use two httpOnly cookies:
//  - access token  (nsude_at, 1 hour): a signed JWT naming the customer and
//    session; checked on every request.
//  - refresh token (nsude_rt, 30 days from last use): a long random value,
//    stored only as a hash in CustomerSession. When the access token has
//    expired, the next request swaps the refresh token for a new pair
//    (rotation) and pushes the 30 days forward — so a customer who comes back
//    within 30 days of their last visit is still signed in.
// Re-using an already-rotated refresh token ends that session (it may have
// been stolen), except within a few seconds of the rotation (two tabs
// refreshing at once). Logging out deletes the session, so its access token
// stops working immediately too. Separate from the admin session.

export const ACCESS_COOKIE = "nsude_at";
export const REFRESH_COOKIE = "nsude_rt";
const LEGACY_COOKIE = "nsude_customer"; // single 30-day token used before
const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_TTL_DAYS = 30;
const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
const ROTATION_GRACE_MS = 30 * 1000;
// The refresh token is only ever needed by API routes.
const REFRESH_PATH = "/api";

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set to a random string of 32+ characters");
  return new TextEncoder().encode(secret);
}

const cookieBase = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
});

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newRefreshToken = () => randomBytes(32).toString("base64url");
const isObjectId = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{24}$/.test(v);

async function signAccessToken(customerId: string, sessionId: string) {
  return new SignJWT({ kind: "customer", sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(customerId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secretKey());
}

// Cookies are written through next/headers, which works in route handlers
// (the only callers); in a page render it would throw, so it's guarded.
function writeCookie(name: string, value: string, maxAgeSeconds: number, path = "/") {
  try {
    cookies().set(name, value, { ...cookieBase(), path, maxAge: maxAgeSeconds });
  } catch {
    // read-only context (e.g. a server component): the session still works
    // for this request; the next API call will write the cookies.
  }
}

async function issueAccess(customerId: string, sessionId: string) {
  writeCookie(ACCESS_COOKIE, await signAccessToken(customerId, sessionId), ACCESS_TTL_SECONDS);
}

function issueRefresh(token: string) {
  writeCookie(REFRESH_COOKIE, token, REFRESH_TTL_MS / 1000, REFRESH_PATH);
}

function clearAuthCookies() {
  writeCookie(ACCESS_COOKIE, "", 0);
  writeCookie(REFRESH_COOKIE, "", 0, REFRESH_PATH);
  writeCookie(LEGACY_COOKIE, "", 0);
}

/** Signs a customer in on this device (after a verified OTP). */
export async function startCustomerSession(customerId: string, userAgent = "") {
  // Tidy up this customer's expired sessions from other devices.
  await db.customerSession.deleteMany({ where: { customerId, expiresAt: { lt: new Date() } } }).catch(() => {});
  const refresh = newRefreshToken();
  const session = await db.customerSession.create({
    data: {
      customerId,
      tokenHash: hashToken(refresh),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: userAgent.slice(0, 200),
    },
  });
  await issueAccess(customerId, session.id);
  issueRefresh(refresh);
}

/** Signs out on this device: deletes the session and clears the cookies. */
export async function endCustomerSession() {
  const store = cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;
  const access = await readAccessToken(store.get(ACCESS_COOKIE)?.value);
  if (refresh) await db.customerSession.deleteMany({ where: { tokenHash: hashToken(refresh) } });
  if (access) await db.customerSession.deleteMany({ where: { id: access.sid } });
  clearAuthCookies();
}

async function readAccessToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.kind !== "customer" || !isObjectId(payload.sub) || !isObjectId(payload.sid)) return null;
    return { customerId: payload.sub, sid: payload.sid };
  } catch {
    return null; // expired, tampered or malformed
  }
}

/**
 * The signed-in customer's id from the access token alone — no database
 * read and no token refresh. For activity tracking, where "probably signed
 * in" is enough and the call must be cheap.
 */
export async function peekCustomerId() {
  return (await readAccessToken(cookies().get(ACCESS_COOKIE)?.value))?.customerId ?? null;
}

/**
 * The signed-in customer, or null. Uses the access token while it's valid;
 * otherwise exchanges the refresh token for a new pair (sliding 30 days).
 */
export async function getCustomer(): Promise<Customer | null> {
  const store = cookies();

  // 1. Valid access token — and its session must still exist (logout ends it).
  const access = await readAccessToken(store.get(ACCESS_COOKIE)?.value);
  if (access) {
    const session = await db.customerSession.findUnique({ where: { id: access.sid } });
    if (session && session.customerId === access.customerId && session.expiresAt > new Date()) {
      return db.customer.findUnique({ where: { id: access.customerId } });
    }
  }

  // 2. Refresh token.
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;
  const hash = hashToken(refresh);
  const now = new Date();

  const session = await db.customerSession.findUnique({ where: { tokenHash: hash } });
  if (session) {
    if (session.expiresAt <= now) {
      await db.customerSession.delete({ where: { id: session.id } }).catch(() => {});
      clearAuthCookies();
      return null;
    }
    // Rotate: a new refresh token, 30 more days from now, and a new access
    // token. The update only succeeds if nobody rotated it in the meantime.
    const next = newRefreshToken();
    const { count } = await db.customerSession.updateMany({
      where: { id: session.id, tokenHash: hash },
      data: {
        tokenHash: hashToken(next),
        previousTokenHash: hash,
        rotatedAt: now,
        expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
        lastUsedAt: now,
      },
    });
    if (count === 1) {
      issueRefresh(next);
      await issueAccess(session.customerId, session.id);
    } else {
      // Lost a race with a parallel request that just rotated it.
      await issueAccess(session.customerId, session.id);
    }
    return db.customer.findUnique({ where: { id: session.customerId } });
  }

  // 3. An old (already rotated) refresh token.
  const rotated = await db.customerSession.findFirst({ where: { previousTokenHash: hash } });
  if (rotated) {
    const justRotated = rotated.rotatedAt && now.getTime() - rotated.rotatedAt.getTime() < ROTATION_GRACE_MS;
    if (justRotated && rotated.expiresAt > now) {
      // Two tabs refreshed at once: the other response carries the new
      // refresh token, so only a fresh access token is needed here.
      await issueAccess(rotated.customerId, rotated.id);
      return db.customer.findUnique({ where: { id: rotated.customerId } });
    }
    // Re-used long after rotation: possibly stolen — end that session.
    await db.customerSession.delete({ where: { id: rotated.id } }).catch(() => {});
  }
  clearAuthCookies();
  return null;
}

export function toAccountData(c: Customer): AccountData {
  return {
    phone: c.phone,
    name: c.name,
    email: c.email,
    addresses: c.addresses.map((a) => ({
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state as AccountData["addresses"][number]["state"],
      pincode: a.pincode,
    })),
    defaultAddressId: c.defaultAddressId ?? null,
  };
}

// ---------------------------------------------------------------------------
// One-time codes
// ---------------------------------------------------------------------------

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/** Codes are stored hashed (with the server secret), never in plain text. */
export function hashOtp(phone: string, code: string) {
  return createHash("sha256").update(`${phone}:${code}:${process.env.AUTH_SECRET ?? ""}`).digest("hex");
}

export function otpMatches(phone: string, code: string, storedHash: string) {
  const a = Buffer.from(hashOtp(phone, code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function newOtpCode() {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/** Random id for a saved address. */
export const newAddressId = () => randomBytes(8).toString("hex");
