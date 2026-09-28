import { NextResponse } from "next/server";
import { consumeLoginToken, findLoginToken, isLiveSchemaMissing } from "@/lib/live/queries";
import { googleEnabled } from "@/lib/auth/google";
import { PLAYER_COOKIE, playerCookieOptions, signPlayerSession } from "@/lib/auth/player";

/**
 * Personal invite link the holder sends on WhatsApp: tap it, you're in for the
 * year. With Google sign-in on, it instead leads to a one-time "continue with
 * Google" step that links the member's Google account.
 */
export async function GET(request: Request, ctx: RouteContext<"/in/[loginToken]">) {
  const { loginToken } = await ctx.params;
  const url = new URL(request.url);

  const google = googleEnabled();
  let match = null;
  try {
    match = await (google ? findLoginToken(loginToken) : consumeLoginToken(loginToken));
  } catch (err) {
    if (!isLiveSchemaMissing(err)) throw err;
  }
  if (!match) {
    return NextResponse.redirect(new URL("/login?invite=expired", url));
  }

  if (google) return NextResponse.redirect(new URL(`/login?invite=${encodeURIComponent(loginToken)}`, url));

  const response = NextResponse.redirect(new URL("/play?welcome=1", url));
  response.cookies.set(
    PLAYER_COOKIE,
    await signPlayerSession({ committeeId: match.committeeId, memberId: match.memberId, epoch: match.epoch }),
    playerCookieOptions
  );
  return response;
}
