// Admin session tokens. Kept free of Node-only APIs because middleware
// (Edge runtime) imports this to guard /admin and /api/admin.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "nsude_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, in seconds

export interface AdminSession {
  email: string;
  role: "superadmin";
}

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of 32+ characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: AdminSession) {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.role !== "superadmin" || typeof payload.email !== "string") return null;
    return { email: payload.email, role: "superadmin" };
  } catch {
    return null;
  }
}
