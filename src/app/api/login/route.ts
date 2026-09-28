import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { normalizePhone } from "@/lib/live/rules";
import { findLoginsByGoogleSub, findLoginsByPhone, markLoggedIn, type LoginMatch } from "@/lib/live/queries";
import { clearGoogleCookies, getGoogleAccount } from "@/lib/auth/google";
import { PLAYER_COOKIE, playerCookieOptions, signPlayerSession } from "@/lib/auth/player";
import { liveErrorResponse } from "@/lib/live/http";

const loginSchema = z.union([
  z.object({
    phone: z.string().max(30),
    memberId: z.string().uuid().optional(), // picks one when a number is in several committees
  }),
  // The committee chooser after Google sign-in: the Google account comes from its cookies.
  z.object({ google: z.literal(true), memberId: z.string().uuid() }),
]);

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your mobile number" }, { status: 400 });

  let matches: LoginMatch[];
  try {
    if ("google" in parsed.data) {
      const account = await getGoogleAccount(request.headers);
      if (!account) {
        return NextResponse.json({ error: "Google sign-in expired. Tap Continue with Google again." }, { status: 401 });
      }
      matches = await findLoginsByGoogleSub(account.sub);
    } else {
      const phone = normalizePhone(parsed.data.phone);
      if (!phone) {
        return NextResponse.json({ error: "That doesn't look like a 10-digit mobile number" }, { status: 400 });
      }
      matches = await findLoginsByPhone(phone);
    }
    if (matches.length === 0) {
      return NextResponse.json(
        {
          error:
            "google" in parsed.data
              ? "This Google account isn't linked to a committee any more. Ask your committee holder for a fresh link."
              : "This number isn't registered yet. Ask your committee holder to add it, or use the personal link they sent you on WhatsApp.",
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
    clearGoogleCookies(cookieStore);
    return NextResponse.json({ ok: true, name: match.memberName });
  } catch (err) {
    return liveErrorResponse(err);
  }
}
