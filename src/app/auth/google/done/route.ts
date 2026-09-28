import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearGoogleCookies, getGoogleAccount } from "@/lib/auth/google";
import { PLAYER_COOKIE, playerCookieOptions, signPlayerSession } from "@/lib/auth/player";
import { parseJoinCode } from "@/lib/live/join";
import { findLoginsByGoogleSub, isLiveSchemaMissing, markLoggedIn } from "@/lib/live/queries";

/**
 * Where Google sign-in lands. Logs the member in if this Google account has
 * already joined; from the shared join link, an account that hasn't joined
 * yet goes on to pick its name.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") === "live" ? "live" : "home";
  const join = url.searchParams.get("join");
  const joinCommitteeId = join ? parseJoinCode(join) : null;
  const cookieStore = await cookies();
  const to = (path: string) => NextResponse.redirect(new URL(path, url));
  const fail = (reason: string) => {
    clearGoogleCookies(cookieStore);
    return to(`/login?google=${reason}`);
  };

  const account = await getGoogleAccount(request.headers);
  if (!account) return fail("failed");

  let matches;
  try {
    matches = await findLoginsByGoogleSub(account.sub);
  } catch (err) {
    if (isLiveSchemaMissing(err)) return fail("failed");
    throw err;
  }
  // From a join link only this committee counts.
  if (joinCommitteeId) matches = matches.filter((m) => m.committeeId === joinCommitteeId);

  if (matches.length === 0) {
    // Keep the Google cookies: the join page needs them to know who is picking.
    if (join && joinCommitteeId) return to(`/join/${encodeURIComponent(join)}`);
    return fail("unknown");
  }
  // Several committees (e.g. real + practice): keep the Google cookies so
  // the chooser on /login can prove which account picked.
  if (matches.length > 1) return to(`/login?google=choose${next === "live" ? "&next=live" : ""}`);

  const match = matches[0];
  await markLoggedIn(match.memberId);
  cookieStore.set(
    PLAYER_COOKIE,
    await signPlayerSession({ committeeId: match.committeeId, memberId: match.memberId, epoch: match.epoch }),
    playerCookieOptions
  );
  clearGoogleCookies(cookieStore);
  return to(next === "live" ? "/play/live" : "/play?welcome=1");
}
