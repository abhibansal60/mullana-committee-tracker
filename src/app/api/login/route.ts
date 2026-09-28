import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { normalizePhone } from "@/lib/live/rules";
import { findLoginsByPhone, markLoggedIn } from "@/lib/live/queries";
import { PLAYER_COOKIE, playerCookieOptions, signPlayerSession } from "@/lib/auth/player";
import { liveErrorResponse } from "@/lib/live/http";

const loginSchema = z.object({
  phone: z.string().max(30),
  memberId: z.string().uuid().optional(), // picks one when a number is in several committees
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your mobile number" }, { status: 400 });

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "That doesn't look like a 10-digit mobile number" }, { status: 400 });
  }

  try {
    const matches = await findLoginsByPhone(phone);
    if (matches.length === 0) {
      return NextResponse.json(
        {
          error:
            "This number isn't registered yet. Ask your committee holder to add it, or use the personal link they sent you on WhatsApp.",
        },
        { status: 404 }
      );
    }

    const match = parsed.data.memberId
      ? matches.find((m) => m.memberId === parsed.data.memberId)
      : matches.length === 1
        ? matches[0]
        : undefined;

    if (!match) {
      return NextResponse.json({
        choose: matches.map((m) => ({
          memberId: m.memberId,
          memberName: m.memberName,
          committeeName: m.committeeName,
        })),
      });
    }

    await markLoggedIn(match.memberId);
    const cookieStore = await cookies();
    cookieStore.set(
      PLAYER_COOKIE,
      await signPlayerSession({ committeeId: match.committeeId, memberId: match.memberId, epoch: match.epoch }),
      playerCookieOptions
    );
    return NextResponse.json({ ok: true, name: match.memberName });
  } catch (err) {
    return liveErrorResponse(err);
  }
}
