import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentPlayer, getLiveState } from "@/lib/live/queries";
import PlayerRoom from "@/components/live/PlayerRoom";

export const metadata: Metadata = { title: "Auction room" };

export default async function PlayerLivePage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/login?next=live");
  const state = await getLiveState(player.committee, { kind: "player", memberId: player.member.id });
  return <PlayerRoom initial={state} />;
}
