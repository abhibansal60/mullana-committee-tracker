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
    <div className="mx-auto max-w-lg px-5 py-8">
      <span className="eyebrow">Committee</span>
      <h1 className="mt-1.5 mb-6 font-[family-name:var(--font-display)] text-2xl font-semibold">
        Settings
      </h1>
      <SettingsForm
        adminToken={adminToken}
        name={committee.name}
        runnerUpBonus={committee.runnerUpBonus}
        reservedMonthNumber={committee.reservedMonthNumber}
        durationMonths={committee.durationMonths}
        reservedMonthLocked={reservedMonthLocked}
        showProfitLoss={committee.showProfitLoss}
      />
    </div>
  );
}
