import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCommitteeById } from "@/lib/db/queries";
import { getGoogleAccount, googleEnabled } from "@/lib/auth/google";
import { parseJoinCode } from "@/lib/live/join";
import { findLoginsByGoogleSub, getCurrentPlayer, getUnclaimedMembers } from "@/lib/live/queries";
import { GoogleButton } from "@/app/login/LoginForm";
import LoginShell from "@/app/login/LoginShell";
import JoinPicker from "./JoinPicker";

export const metadata: Metadata = { title: "Join · Mullana Committee" };

export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code: rawCode } = await params;
  const code = decodeURIComponent(rawCode);
  const committeeId = parseJoinCode(code);
  const committee = committeeId ? await getCommitteeById(committeeId) : null;

  if (!committee) {
    return (
      <LoginShell title="This link isn't valid" subtitle="Ask your committee holder to send the join link again.">
        <p className="text-center text-sm text-[var(--arena-muted)]">Check the link was copied in full.</p>
      </LoginShell>
    );
  }

  const player = await getCurrentPlayer();
  if (player?.committee.id === committee.id) redirect("/play");

  if (!googleEnabled()) {
    return (
      <LoginShell title={committee.name} subtitle="Google sign-in isn't switched on yet.">
        <p className="text-center text-sm text-[var(--arena-muted)]">Ask the holder to set it up, then come back to this link.</p>
      </LoginShell>
    );
  }

  const account = await getGoogleAccount(await headers());
  if (!account) {
    return (
      <LoginShell title={`Join ${committee.name}`} subtitle="Sign in once with Google, then pick your name. Next time, just tap Continue with Google.">
        <GoogleButton href={`/auth/google?join=${encodeURIComponent(code)}`} />
      </LoginShell>
    );
  }

  // Already joined with this Google account? Let the done route log them in.
  const already = (await findLoginsByGoogleSub(account.sub)).some((m) => m.committeeId === committee.id);
  if (already) redirect(`/auth/google/done?join=${encodeURIComponent(code)}`);

  const unclaimed = await getUnclaimedMembers(committee.id);
  return (
    <LoginShell title={`Join ${committee.name}`} subtitle="Which one are you?">
      <JoinPicker code={code} members={unclaimed} />
    </LoginShell>
  );
}
