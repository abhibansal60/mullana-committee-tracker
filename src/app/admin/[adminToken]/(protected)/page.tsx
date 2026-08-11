import Link from "next/link";
import { requireAdminByToken } from "@/lib/auth/guard";
import {
  getMembersForCommittee,
  getMonthsForCommittee,
  getMonthsSummary,
} from "@/lib/db/queries";
import { formatRupees } from "@/lib/money";
import Stamp from "@/components/Stamp";

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
    <div className="mx-auto max-w-lg space-y-8 px-5 py-8">
      <section className="card p-5">
        <span className="eyebrow">The pot</span>
        <p className="money mt-1 text-3xl font-medium">
          {formatRupees(committee.monthlyContribution * committee.memberCount)}
        </p>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          {formatRupees(committee.monthlyContribution)}/month ×{" "}
          {committee.memberCount} members · {committee.durationMonths} months
        </p>
      </section>

      <section>
        <h2 className="eyebrow mb-2 px-1">Members</h2>
        <ul className="card divide-y divide-[var(--border-subtle)] px-4">
          {members.map((m) => {
            const wonMonth = wonMonthByMemberId.get(m.id);
            return (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <span className="flex items-center gap-2">
                  {m.name}
                  {m.isHolder && <Stamp tone="muted">Holder</Stamp>}
                </span>
                <span className="money text-xs text-[var(--muted)]">
                  {wonMonth ? `Won month ${wonMonth}` : "Not yet won"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="eyebrow mb-2 px-1">Monthly log</h2>
        <ul className="card divide-y divide-[var(--border-subtle)] px-4">
          {monthsSummary.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/${adminToken}/months/${m.id}`}
                className="-mx-4 flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-[var(--background)]"
              >
                <span>
                  <span className="flex items-center gap-2">
                    Month {m.monthNumber}
                    {m.isReserved && <Stamp tone="muted">Reserved</Stamp>}
                  </span>
                  {m.winnerName && (
                    <span className="money mt-0.5 block text-xs text-[var(--muted)]">
                      Won by {m.winnerName}
                      {m.winningBid ? ` · bid ${formatRupees(m.winningBid)}` : ""}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right text-xs font-medium">
                  {!m.auctionRecordedAt ? (
                    <Stamp tone="brass">Record auction →</Stamp>
                  ) : m.fullyCollected ? (
                    <Stamp tone="cloth">Fully collected</Stamp>
                  ) : (
                    <span className="money text-[var(--muted)]">
                      {m.collectedCount}/{m.totalCount}
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
