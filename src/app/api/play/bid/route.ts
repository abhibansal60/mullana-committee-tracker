import { NextResponse } from "next/server";
import { z } from "zod";
import { getLiveState, placeBid } from "@/lib/live/queries";
import { currentPlayerOr401, liveErrorResponse, noStore } from "@/lib/live/http";

const bidSchema = z.object({
  expectedBid: z.number().int().nullable(),
  amount: z.number().int().positive(),
});

export async function POST(request: Request) {
  const player = await currentPlayerOr401();
  if (player instanceof NextResponse) return player;

  const parsed = bidSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid bid" }, { status: 400 });

  const viewer = { kind: "player" as const, memberId: player.member.id };
  try {
    await placeBid(player.committee, player.member.id, parsed.data.expectedBid, parsed.data.amount);
    return NextResponse.json({ ok: true, state: await getLiveState(player.committee, viewer) }, noStore);
  } catch (err) {
    // Hand back fresh state with the error so the room can snap to reality
    // ("Too slow!") without waiting for the next poll.
    const response = liveErrorResponse(err);
    try {
      const body = await response.json();
      const state = await getLiveState(player.committee, viewer);
      return NextResponse.json({ ...body, state }, { status: response.status, ...noStore });
    } catch {
      return response;
    }
  }
}
