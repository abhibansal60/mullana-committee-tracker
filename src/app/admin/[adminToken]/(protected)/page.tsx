import Link from "next/link";
import { requireAdminByToken } from "@/lib/auth/guard";
import {
  getMembersForCommittee,
  getMonthsForCommittee,
  getMonthsSummary,
} from "@/lib/db/queries";
import { formatRupees } from "@/lib/money";

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ adminToken: string }>;
}) {
  const { adminToken } = await params;
  const committee = await requireAdminByToken(adminToken);

  const [members, rawMonths, monthsSummary] = await Promise.all([
    getMembersForCommittee(committee.id),
    getMonthsForCommittee(committee.id),
    getMonthsSummary(committee.id),
  ]);

  const wonMonthByMemberId = new Map<string, number>();
  for (const m of rawMonths) {
    if (m.auctionRecordedAt) {
      const winnerId =
        m.monthNumber === committee.reservedMonthNumber
          ? members.find((mem) => mem.isHolder)?.id
          : m.winnerMemberId;
      if (winnerId) wonMonthByMemberId.set(winnerId, m.monthNumber);
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6 space-y-8">
      <section>
        <p className="text-sm text-neutral-500">
          {formatRupees(committee.monthlyContribution)}/month ×{" "}
          {committee.memberCount} members · pot{" "}
          {formatRupees(committee.monthlyContribution * committee.memberCount)}{" "}
          · {committee.durationMonths} months
        </p>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500 mb-2">Members</h2>
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
          {members.map((m) => {
            const wonMonth = wonMonthByMemberId.get(m.id);
            return (
              <li
                key={m.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span>
                  {m.name}
                  {m.isHolder && (
                    <span className="ml-2 text-xs text-neutral-400">
                      Holder
                    </span>
                  )}
                </span>
                <span className="text-xs text-neutral-500">
                  {wonMonth ? `Won month ${wonMonth}` : "Not yet won"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500 mb-2">
          Monthly log
        </h2>
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
          {monthsSummary.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/${adminToken}/months/${m.id}`}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <span>
                  Month {m.monthNumber}
                  {m.isReserved && (
                    <span className="ml-2 text-xs text-neutral-400">
                      Reserved
                    </span>
                  )}
                  {m.winnerName && (
                    <span className="block text-xs text-neutral-500">
                      Won by {m.winnerName}
                      {m.winningBid ? ` · bid ${formatRupees(m.winningBid)}` : ""}
                    </span>
                  )}
                </span>
                <span className="text-xs font-medium">
                  {!m.auctionRecordedAt ? (
                    <span className="text-amber-600">Record auction →</span>
                  ) : m.fullyCollected ? (
                    <span className="text-green-600">Fully collected</span>
                  ) : (
                    <span className="text-neutral-500">
                      Collecting {m.collectedCount}/{m.totalCount}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
