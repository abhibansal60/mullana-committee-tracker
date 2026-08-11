import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  getCommitteeByAdminTokenHash,
  getCommitteeByMemberTokenHash,
  type Committee,
} from "@/lib/db/queries";
import { sha256Hex } from "./tokens";
import { verifySession, sessionCookieName } from "./session";

export class UnauthorizedError extends Error {}

/**
 * Used by `/admin/[adminToken]/layout.tsx` (except the `/login` page).
 * Only reads the session cookie - never mutates it, which keeps this safe to
 * call during plain Server Component rendering (Next.js forbids cookie
 * mutation outside Server Actions / Route Handlers).
 */
export async function requireAdminByToken(
  adminToken: string
): Promise<Committee> {
  const committee = await getCommitteeByAdminTokenHash(sha256Hex(adminToken));
  if (!committee) notFound();

  const cookieStore = await cookies();
  const cookie = cookieStore.get(sessionCookieName("admin", committee.id));
  const session = cookie ? await verifySession(cookie.value) : null;
  if (!session || session.role !== "admin" || session.sub !== committee.id) {
    redirect(`/admin/${adminToken}/login`);
  }
  return committee;
}

/**
 * Used inside API route handlers that only have a resource id (monthId,
 * paymentId, ...), not the adminToken. Throws UnauthorizedError - callers
 * should catch and return a 401.
 */
export async function requireAdminForCommittee(
  committeeId: string
): Promise<void> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(sessionCookieName("admin", committeeId));
  const session = cookie ? await verifySession(cookie.value) : null;
  if (!session || session.role !== "admin" || session.sub !== committeeId) {
    throw new UnauthorizedError("Admin session required");
  }
}

/**
 * Used by `/c/[memberToken]/layout.tsx`. The token in the URL *is* the
 * credential for read-only access - no session cookie needed, so this is a
 * pure lookup (also safe to call during plain Server Component rendering).
 */
export async function requireMemberByToken(
  memberToken: string
): Promise<Committee> {
  const committee = await getCommitteeByMemberTokenHash(sha256Hex(memberToken));
  if (!committee) notFound();
  return committee;
}
