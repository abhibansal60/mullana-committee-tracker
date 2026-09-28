import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getOtherMemberships, markLoggedIn } from "@/lib/live/queries";
import { PLAYER_COOKIE, playerCookieOptions, signPlayerSession } from "@/lib/auth/player";
import { currentPlayerOr401, liveErrorResponse } from "@/lib/live/http";

const switchSchema = z.object({ memberId: z.string().uuid() });

/** Hop between committees that share this member's phone number (e.g. real ↔ practice). */
export async function POST(request: Request) {
  const player = await currentPlayerOr401();
  if (player instanceof NextResponse) return player;
  const parsed = switchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const target = (await getOtherMemberships(player.member.id)).find((m) => m.memberId === parsed.data.memberId);
    if (!target) return NextResponse.json({ error: "Not one of your committees" }, { status: 403 });
    await markLoggedIn(target.memberId);
    const cookieStore = await cookies();
    cookieStore.set(
      PLAYER_COOKIE,
      await signPlayerSession({ committeeId: target.committeeId, memberId: target.memberId, epoch: target.epoch }),
      playerCookieOptions
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return liveErrorResponse(err);
  }
}
