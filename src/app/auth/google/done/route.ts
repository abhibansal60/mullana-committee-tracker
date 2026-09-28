import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearGoogleCookies, getGoogleAccount } from "@/lib/auth/google";
import { PLAYER_COOKIE, playerCookieOptions, signPlayerSession } from "@/lib/auth/player";
import {
  findLoginsByGoogleSub,
  isLiveSchemaMissing,
  linkGoogleAccount,
  LiveError,
  markLoggedIn,
  type LoginMatch,
} from "@/lib/live/queries";

/** Where Google sign-in lands: link the account to an invite, or log in with it. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") === "live" ? "live" : "home";
  const cookieStore = await cookies();
  const to = (path: string) => NextResponse.redirect(new URL(path, url));
  const fail = (reason: string) => {
    clearGoogleCookies(cookieStore);
    return to(`/login?google=${reason}`);
  };

  const account = await getGoogleAccount(request.headers);
  if (!account) return fail("failed");

  let match: LoginMatch | null | undefined;
  try {
    const invite = url.searchParams.get("invite");
    if (invite) {
      match = await linkGoogleAccount(invite, account.sub, account.email);
      if (!match) {
        clearGoogleCookies(cookieStore);
        return to("/login?invite=expired");
      }
    } else {
      const matches = await findLoginsByGoogleSub(account.sub);
      if (matches.length === 0) return fail("unknown");
      // Several committees (e.g. real + practice): keep the Google cookies so
      // the chooser on /login can prove which account picked.
      if (matches.length > 1) return to(`/login?google=choose${next === "live" ? "&next=live" : ""}`);
      match = matches[0];
      await markLoggedIn(match.memberId);
    }
  } catch (err) {
    if (err instanceof LiveError) return fail("taken");
    if (isLiveSchemaMissing(err)) return fail("failed");
    throw err;
  }

  cookieStore.set(
    PLAYER_COOKIE,
    await signPlayerSession({ committeeId: match.committeeId, memberId: match.memberId, epoch: match.epoch }),
    playerCookieOptions
  );
  clearGoogleCookies(cookieStore);
  return to(next === "live" ? "/play/live" : "/play?welcome=1");
}
