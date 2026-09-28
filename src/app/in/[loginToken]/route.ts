import { NextResponse } from "next/server";
import { consumeLoginToken, isLiveSchemaMissing } from "@/lib/live/queries";
import { PLAYER_COOKIE, playerCookieOptions, signPlayerSession } from "@/lib/auth/player";

/** Personal invite link the holder sends on WhatsApp: tap it, you're in for the year. */
export async function GET(request: Request, ctx: RouteContext<"/in/[loginToken]">) {
  const { loginToken } = await ctx.params;
  const url = new URL(request.url);

  let match = null;
  try {
    match = await consumeLoginToken(loginToken);
  } catch (err) {
    if (!isLiveSchemaMissing(err)) throw err;
  }
  if (!match) {
    return NextResponse.redirect(new URL("/login?invite=expired", url));
  }

  const response = NextResponse.redirect(new URL("/play?welcome=1", url));
  response.cookies.set(
    PLAYER_COOKIE,
    await signPlayerSession({ committeeId: match.committeeId, memberId: match.memberId, epoch: match.epoch }),
    playerCookieOptions
  );
  return response;
}
