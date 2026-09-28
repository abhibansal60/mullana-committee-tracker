import { SignJWT, jwtVerify } from "jose";

/**
 * A "player" is a logged-in committee member (as opposed to the holder's
 * admin session). One cookie per browser - a phone belongs to one person -
 * valid for the whole committee year.
 */
export interface PlayerSession {
  committeeId: string;
  memberId: string;
  epoch: number; // must match member_profiles.session_epoch
}

export const PLAYER_COOKIE = "player";
export const PLAYER_SESSION_MAX_AGE = 60 * 60 * 24 * 400; // a committee year, with slack

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signPlayerSession(s: PlayerSession): Promise<string> {
  return new SignJWT({ role: "player", mid: s.memberId, ep: s.epoch })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.committeeId)
    .setIssuedAt()
    .setExpirationTime(`${PLAYER_SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
}

export async function verifyPlayerSession(token: string): Promise<PlayerSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      payload.role !== "player" ||
      typeof payload.sub !== "string" ||
      typeof payload.mid !== "string" ||
      typeof payload.ep !== "number"
    ) {
      return null;
    }
    return { committeeId: payload.sub, memberId: payload.mid, epoch: payload.ep };
  } catch {
    return null;
  }
}

export const playerCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: PLAYER_SESSION_MAX_AGE,
};
