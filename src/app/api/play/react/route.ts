import { NextResponse } from "next/server";
import { z } from "zod";
import { addReaction } from "@/lib/live/queries";
import { currentPlayerOr401, liveErrorResponse } from "@/lib/live/http";

const reactSchema = z.object({ emoji: z.string().max(8) });

export async function POST(request: Request) {
  const player = await currentPlayerOr401();
  if (player instanceof NextResponse) return player;
  const parsed = reactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
  try {
    await addReaction(player.committee, player.member.id, parsed.data.emoji);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return liveErrorResponse(err);
  }
}
