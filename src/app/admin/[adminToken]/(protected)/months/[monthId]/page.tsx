import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminByToken } from "@/lib/auth/guard";
import { getMonthDetail, getEligibleAuctionMembers } from "@/lib/db/queries";
import { formatRupees } from "@/lib/money";
import AuctionForm from "@/components/admin/AuctionForm";
import PaymentsSection from "@/components/admin/PaymentsSection";
import Stamp from "@/components/Stamp";

export default async function AdminMonthDetailPage({
  params,
}: {
  params: Promise<{ adminToken: string; monthId: string }>;
}) {
  const { adminToken, monthId } = await params;
  const committee = await requireAdminByToken(adminToken);

  const detail = await getMonthDetail(monthId);
  if (!detail || detail.committee.id !== committee.id) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6 px-5 py-8">
      <Link
        href={`/admin/${adminToken}`}
        className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        ← Back
      </Link>

      <div>
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-semibold">
          Month {detail.month.monthNumber}
          {detail.isReserved && <Stamp tone="muted">Reserved</Stamp>}
        </h1>
        {detail.dues && (
          <p className="money mt-1.5 text-sm text-[var(--muted)]">
            Pot {formatRupees(detail.dues.pot)} · Payout to winner{" "}
            {formatRupees(detail.dues.payoutToWinner)}
          </p>
        )}
      </div>

      {!detail.month.auctionRecordedAt ? (
        <AuctionForm
          monthId={monthId}
          isReservedMonth={detail.isReserved}
          eligibleMembers={await getEligibleAuctionMembers(committee.id, monthId)}
        />
      ) : (
        <div>
          <h2 className="eyebrow mb-2 px-1">Payments</h2>
          <PaymentsSection monthId={monthId} members={detail.members} />

          <details className="mt-5">
            <summary className="cursor-pointer text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
              Edit auction result
            </summary>
            <div className="mt-3">
              <AuctionForm
                monthId={monthId}
                isReservedMonth={detail.isReserved}
                eligibleMembers={await getEligibleAuctionMembers(
                  committee.id,
                  monthId
                )}
              />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
