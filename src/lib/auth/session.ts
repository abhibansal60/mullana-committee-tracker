import { SignJWT, jwtVerify } from "jose";

export type SessionRole = "admin" | "member";

export interface SessionPayload {
  sub: string; // committeeId
  role: SessionRole;
}

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "admin" && payload.role !== "member")
    ) {
      return null;
    }
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export function sessionCookieName(
  role: SessionRole,
  committeeId: string
): string {
  return `${role}_${committeeId}`;
}

export const SESSION_COOKIE_MAX_AGE = SESSION_MAX_AGE_SECONDS;
