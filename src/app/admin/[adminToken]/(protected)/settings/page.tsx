import { requireAdminByToken } from "@/lib/auth/guard";
import { hasAnyAuctionRecorded } from "@/lib/db/queries";
import SettingsForm from "@/components/admin/SettingsForm";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ adminToken: string }>;
}) {
  const { adminToken } = await params;
  const committee = await requireAdminByToken(adminToken);
  const reservedMonthLocked = await hasAnyAuctionRecorded(committee.id);

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="text-lg font-semibold mb-6">Settings</h1>
      <SettingsForm
        adminToken={adminToken}
        name={committee.name}
        runnerUpBonus={committee.runnerUpBonus}
        reservedMonthNumber={committee.reservedMonthNumber}
        durationMonths={committee.durationMonths}
        reservedMonthLocked={reservedMonthLocked}
      />
    </div>
  );
}
