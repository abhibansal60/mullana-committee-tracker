import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminByToken } from "@/lib/auth/guard";
import { getMonthDetail, getEligibleAuctionMembers } from "@/lib/db/queries";
import { formatRupees } from "@/lib/money";
import AuctionForm from "@/components/admin/AuctionForm";
import PaymentForm from "@/components/admin/PaymentForm";

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
    <div className="mx-auto max-w-lg p-6 space-y-6">
      <Link href={`/admin/${adminToken}`} className="text-sm text-neutral-500">
        ← Back
      </Link>

      <div>
        <h1 className="text-lg font-semibold">
          Month {detail.month.monthNumber}
          {detail.isReserved && (
            <span className="ml-2 text-sm font-normal text-neutral-400">
              Reserved
            </span>
          )}
        </h1>
        {detail.dues && (
          <p className="text-sm text-neutral-500 mt-1">
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
          <h2 className="text-sm font-medium text-neutral-500 mb-2">
            Payments
          </h2>
          <div>
            {detail.members.map((m) => (
              <PaymentForm key={m.memberId} monthId={monthId} member={m} />
            ))}
          </div>

          <details className="mt-4">
            <summary className="text-xs text-neutral-500 cursor-pointer">
              Edit auction result
            </summary>
            <div className="mt-2">
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
