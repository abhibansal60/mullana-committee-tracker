import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  getCommitteeByAdminTokenHash,
  getCommitteeByMemberTokenHash,
  type Committee,
} from "@/lib/db/queries";
import { sha256Hex } from "./tokens";
import { verifySession, sessionCookieName } from "./session";

/**
 * Whether this browser holds a valid admin session for the committee. The one
 * check every admin page and route goes through. Only reads the session
 * cookie - never mutates it, which keeps it safe to call during plain Server
 * Component rendering (Next.js forbids cookie mutation outside Server
 * Actions / Route Handlers).
 */
export async function isAdminFor(committeeId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(sessionCookieName("admin", committeeId));
  const session = cookie ? await verifySession(cookie.value) : null;
  return !!session && session.role === "admin" && session.sub === committeeId;
}

/** Used by `/admin/[adminToken]/layout.tsx` (except the `/login` page). */
export async function requireAdminByToken(
  adminToken: string
): Promise<Committee> {
  const committee = await getCommitteeByAdminTokenHash(sha256Hex(adminToken));
  if (!committee) notFound();
  if (!(await isAdminFor(committee.id))) redirect(`/admin/${adminToken}/login`);
  return committee;
}

/** For API routes addressed by adminToken: the committee, or the 404/401 to return instead. */
export async function adminCommittee(adminToken: string): Promise<Committee | NextResponse> {
  const committee = await getCommitteeByAdminTokenHash(sha256Hex(adminToken));
  if (!committee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return (await adminGate(committee.id)) ?? committee;
}

/**
 * For API routes that only have a resource id (monthId, paymentId, ...), once
 * they've looked up its committee: null to carry on, or the 401 to return.
 */
export async function adminGate(committeeId: string): Promise<NextResponse | null> {
  return (await isAdminFor(committeeId))
    ? null
    : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
