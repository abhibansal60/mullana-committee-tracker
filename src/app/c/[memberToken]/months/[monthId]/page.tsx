import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMemberByToken } from "@/lib/auth/guard";
import { getMonthDetail } from "@/lib/db/queries";
import { formatRupees } from "@/lib/money";
import MemberBreakdownTable from "@/components/MemberBreakdownTable";
import Stamp from "@/components/Stamp";

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
    <div className="mx-auto max-w-lg space-y-6 px-5 py-8">
      <Link
        href={`/c/${memberToken}`}
        className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        ← Back
      </Link>

      <div>
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-2xl font-semibold">
          Month {detail.month.monthNumber}
          {detail.isReserved && <Stamp tone="muted">Reserved</Stamp>}
        </h1>
        {!detail.dues ? (
          <p className="mt-1.5 text-sm text-[var(--muted)]">
            Auction result not recorded yet.
          </p>
        ) : (
          <p className="money mt-1.5 text-sm text-[var(--muted)]">
            Pot {formatRupees(detail.dues.pot)} · Payout to winner{" "}
            {formatRupees(detail.dues.payoutToWinner)}
          </p>
        )}
      </div>

      {detail.dues && (
        <div className="card px-4">
          <MemberBreakdownTable
            members={detail.members}
            runnerUpBonus={detail.committee.runnerUpBonus}
          />
        </div>
      )}
    </div>
  );
}
