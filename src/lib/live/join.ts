import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The committee's one shared join link is `/join/<committeeId>.<signature>`.
 * The signature is an HMAC of the id, so the link needs no storage and can't
 * be guessed from the id alone.
 */
function sign(committeeId: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`join:${committeeId}`).digest("base64url").slice(0, 22);
}

export function joinCode(committeeId: string): string {
  return `${committeeId}.${sign(committeeId)}`;
}

/** The committee id a join code belongs to, or null if it isn't a genuine code. */
export function parseJoinCode(code: string): string | null {
  const [id, sig, ...rest] = code.split(".");
  if (!id || !sig || rest.length > 0 || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}
