import { NextResponse } from "next/server";
import { getLiveState } from "@/lib/live/queries";
import { currentPlayerOr401, liveErrorResponse, noStore } from "@/lib/live/http";

export async function GET(request: Request) {
  const player = await currentPlayerOr401();
  if (player instanceof NextResponse) return player;
  try {
    const state = await getLiveState(player.committee, {
      kind: "player",
      memberId: player.member.id,
      peek: new URL(request.url).searchParams.has("peek"),
    });
    return NextResponse.json(state, noStore);
  } catch (err) {
    return liveErrorResponse(err);
  }
}
