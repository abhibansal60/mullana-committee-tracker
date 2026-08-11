import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMemberByToken } from "@/lib/auth/guard";
import { getMonthDetail } from "@/lib/db/queries";
import { formatRupees } from "@/lib/money";
import MemberBreakdownTable from "@/components/MemberBreakdownTable";

export default async function MemberMonthDetailPage({
  params,
}: {
  params: Promise<{ memberToken: string; monthId: string }>;
}) {
  const { memberToken, monthId } = await params;
  const committee = await requireMemberByToken(memberToken);

  const detail = await getMonthDetail(monthId);
  if (!detail || detail.committee.id !== committee.id) notFound();

  return (
    <div className="mx-auto max-w-lg p-6 space-y-6">
      <Link href={`/c/${memberToken}`} className="text-sm text-neutral-500">
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
        {!detail.dues ? (
          <p className="text-sm text-neutral-500 mt-1">
            Auction result not recorded yet.
          </p>
        ) : (
          <p className="text-sm text-neutral-500 mt-1">
            Pot {formatRupees(detail.dues.pot)} · Payout to winner{" "}
            {formatRupees(detail.dues.payoutToWinner)}
          </p>
        )}
      </div>

      {detail.dues && (
        <MemberBreakdownTable
          members={detail.members}
          runnerUpBonus={detail.committee.runnerUpBonus}
        />
      )}
    </div>
  );
}
