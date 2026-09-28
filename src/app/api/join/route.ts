import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { clearGoogleCookies, getGoogleAccount } from "@/lib/auth/google";
import { PLAYER_COOKIE, playerCookieOptions, signPlayerSession } from "@/lib/auth/player";
import { parseJoinCode } from "@/lib/live/join";
import { claimMember, markLoggedIn } from "@/lib/live/queries";
import { liveErrorResponse } from "@/lib/live/http";

const joinSchema = z.object({ code: z.string().max(100), memberId: z.string().uuid() });

/** The join page: the signed-in Google account picks which member it is. */
export async function POST(request: Request) {
  const parsed = joinSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick your name" }, { status: 400 });
  const committeeId = parseJoinCode(parsed.data.code);
  if (!committeeId) return NextResponse.json({ error: "This join link isn't valid" }, { status: 404 });

  const account = await getGoogleAccount(request.headers);
  if (!account) {
    return NextResponse.json({ error: "Google sign-in expired. Tap Continue with Google again." }, { status: 401 });
  }
  try {
    const match = await claimMember(committeeId, parsed.data.memberId, account.sub, account.email);
    await markLoggedIn(match.memberId);
    const cookieStore = await cookies();
    cookieStore.set(
      PLAYER_COOKIE,
      await signPlayerSession({ committeeId: match.committeeId, memberId: match.memberId, epoch: match.epoch }),
      playerCookieOptions
    );
    clearGoogleCookies(cookieStore);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return liveErrorResponse(err);
  }
}
