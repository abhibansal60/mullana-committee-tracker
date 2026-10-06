import { NextResponse } from "next/server";
import { getCommitteeByAdminTokenHash } from "@/lib/db/queries";
import { sha256Hex } from "@/lib/auth/tokens";
import { isAdminFor } from "@/lib/auth/guard";
import { signSession, sessionCookieName, SESSION_COOKIE_MAX_AGE, pinStamp } from "@/lib/auth/session";
import {
  PRACTICE_PARENT_COOKIE,
  createPracticeCommittee,
  deletePracticeCommittee,
  getPracticeCommittee,
  practiceAdminToken,
} from "@/lib/live/practice";
import { isPracticeCommittee } from "@/lib/live/rules";

/**
 * The real holder's door into their practice room:
 *   GET /admin/<token>/practice          open (creating the copy if needed)
 *   GET /admin/<token>/practice?reset=1  wipe and start fresh
 *   GET /admin/<token>/practice?delete=1 remove the practice copy
 * Signs the holder into the practice copy too, so there's no second PIN.
 */
export async function GET(request: Request, ctx: RouteContext<"/admin/[adminToken]/practice">) {
  const { adminToken } = await ctx.params;
  const url = new URL(request.url);
  const real = await getCommitteeByAdminTokenHash(sha256Hex(adminToken));
  if (!real || isPracticeCommittee(real)) return new NextResponse("Not found", { status: 404 });

  if (!(await isAdminFor(real))) {
    return NextResponse.redirect(new URL(`/admin/${adminToken}/login`, url));
  }

  if (url.searchParams.has("delete")) {
    await deletePracticeCommittee(real);
    return NextResponse.redirect(new URL(`/admin/${adminToken}?practice=deleted`, url));
  }

  let practice = url.searchParams.has("reset") ? null : await getPracticeCommittee(real);
  if (!practice) practice = await createPracticeCommittee(real);

  const practiceToken = practiceAdminToken(real.id);
  const response = NextResponse.redirect(
    new URL(`/admin/${practiceToken}/live?parent=${encodeURIComponent(adminToken)}`, url)
  );
  response.cookies.set(sessionCookieName("admin", practice.id), await signSession({ sub: practice.id, role: "admin", pin: pinStamp(practice.adminPinHash) }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
  response.cookies.set(PRACTICE_PARENT_COOKIE, adminToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
  return response;
}
