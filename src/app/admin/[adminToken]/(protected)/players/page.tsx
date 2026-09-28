import { requireAdminByToken } from "@/lib/auth/guard";
import { getMembersForCommittee } from "@/lib/db/queries";
import { getProfilesForCommittee, isLiveSchemaMissing } from "@/lib/live/queries";
import { SCHEMA_MISSING_MESSAGE } from "@/lib/live/http";
import PlayersManager from "@/components/admin/PlayersManager";

export default async function PlayersPage({ params }: PageProps<"/admin/[adminToken]/players">) {
  const { adminToken } = await params;
  const committee = await requireAdminByToken(adminToken);

  let profiles;
  try {
    profiles = await getProfilesForCommittee(committee.id);
  } catch (err) {
    if (!isLiveSchemaMissing(err)) throw err;
    return (
      <div className="mx-auto max-w-lg px-5 py-8">
        <p className="card p-4 text-sm">{SCHEMA_MISSING_MESSAGE}</p>
      </div>
    );
  }
  const members = await getMembersForCommittee(committee.id);
  const byId = new Map(profiles.map((p) => [p.memberId, p]));
  const players = [...members]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => {
      const p = byId.get(m.id);
      return {
        memberId: m.id,
        name: m.name,
        isHolder: m.isHolder,
        phone: p?.phone ?? null,
        hasInvite: !!p?.loginTokenHash,
        lastLoginAt: p?.lastLoginAt?.toISOString() ?? null,
        lastSeenAt: p?.lastSeenAt?.toISOString() ?? null,
      };
    });

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <span className="eyebrow">Committee</span>
      <h1 className="mt-1.5 mb-6 font-[family-name:var(--font-display)] text-2xl font-semibold">Players</h1>
      <PlayersManager adminToken={adminToken} committeeName={committee.name} players={players} />
    </div>
  );
}
