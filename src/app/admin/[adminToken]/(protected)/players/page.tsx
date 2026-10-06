import { requireAdminByToken } from "@/lib/auth/guard";
import { getMembersForCommittee } from "@/lib/db/queries";
import { joinCode } from "@/lib/live/join";
import {
  getGoogleEmails,
  getLiveSettings,
  getProfilesForCommittee,
  isLiveSchemaMissing,
} from "@/lib/live/queries";
import { SCHEMA_MISSING_MESSAGE } from "@/lib/live/http";
import PlayersManager from "@/components/admin/PlayersManager";

export default async function PlayersPage({ params }: PageProps<"/admin/[adminToken]/players">) {
  const { adminToken } = await params;
  const committee = await requireAdminByToken(adminToken);

  let profiles, emails, settings;
  try {
    [profiles, emails, settings] = await Promise.all([
      getProfilesForCommittee(committee.id),
      getGoogleEmails(committee.id),
      getLiveSettings(committee),
    ]);
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
        joined: emails.has(m.id),
        email: emails.get(m.id) ?? null,
        lastLoginAt: p?.lastLoginAt?.toISOString() ?? null,
        lastSeenAt: p?.lastSeenAt?.toISOString() ?? null,
      };
    });

  return (
    <div className="mx-auto max-w-lg px-4 py-5 md:py-8">
      <h1 className="mb-4 px-1 font-[family-name:var(--font-display)] text-2xl font-semibold">Players</h1>
      <PlayersManager
        adminToken={adminToken}
        committeeName={committee.name}
        joinCode={joinCode(committee.id)}
        phoneLogin={settings.allowPhoneLogin}
        players={players}
      />
    </div>
  );
}
