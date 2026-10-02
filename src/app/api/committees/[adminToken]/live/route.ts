import { NextResponse } from "next/server";
import { z } from "zod";
import { addReaction, getDisplaySession, getLiveState, openLobby, placeBid, runHostAction } from "@/lib/live/queries";
import { runBots } from "@/lib/live/practice";
import { isPracticeCommittee } from "@/lib/live/rules";
import { adminCommittee } from "@/lib/auth/guard";
import { liveErrorResponse, noStore } from "@/lib/live/http";

export async function GET(request: Request, ctx: RouteContext<"/api/committees/[adminToken]/live">) {
  const { adminToken } = await ctx.params;
  const committee = await adminCommittee(adminToken);
  if (committee instanceof NextResponse) return committee;
  try {
    // Practice room: the host's console drives the bots on each poll.
    if (isPracticeCommittee(committee) && new URL(request.url).searchParams.has("bots")) {
      await runBots(committee, await getDisplaySession(committee.id));
    }
    return NextResponse.json(await getLiveState(committee, { kind: "host" }), noStore);
  } catch (err) {
    return liveErrorResponse(err);
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open"), monthId: z.string().uuid() }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("extend") }),
  z.object({ action: z.literal("hammer") }),
  z.object({ action: z.literal("undo") }),
  z.object({ action: z.literal("reopen") }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("finalize"), runnerUpMemberId: z.string().uuid().optional() }),
  z.object({ action: z.literal("react"), emoji: z.string().max(8) }),
  // The holder bidding for a member who isn't in the room.
  z.object({
    action: z.literal("bid"),
    memberId: z.string().uuid(),
    expectedBid: z.number().int().nullable(),
    amount: z.number().int().positive(),
  }),
]);

export async function POST(request: Request, ctx: RouteContext<"/api/committees/[adminToken]/live">) {
  const { adminToken } = await ctx.params;
  const committee = await adminCommittee(adminToken);
  if (committee instanceof NextResponse) return committee;

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const input = parsed.data;

  try {
    if (input.action === "open") await openLobby(committee, input.monthId);
    else if (input.action === "react") await addReaction(committee, null, input.emoji);
    else if (input.action === "bid") await placeBid(committee, input.memberId, input.expectedBid, input.amount);
    else await runHostAction(committee, input);
    return NextResponse.json({ ok: true, state: await getLiveState(committee, { kind: "host" }) }, noStore);
  } catch (err) {
    return liveErrorResponse(err);
  }
}
