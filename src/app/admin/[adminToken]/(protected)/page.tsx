import Link from "next/link";
import { requireAdminByToken } from "@/lib/auth/guard";
import {
  getCommitteeLedger,
  getMembersForCommittee,
  summarizeLedger,
  type MonthDetail,
} from "@/lib/db/queries";
import { formatRupees } from "@/lib/money";
import { joinCode } from "@/lib/live/join";
import { getGoogleEmails, isLiveSchemaMissing } from "@/lib/live/queries";
import Stamp from "@/components/Stamp";
import ProfitLossSummary from "@/components/ProfitLossSummary";
import CommitteeDayCard from "@/components/admin/CommitteeDayCard";
import PracticeCard from "@/components/admin/PracticeCard";
import ShareJoinLink from "@/components/admin/ShareJoinLink";
import { isPracticeCommittee } from "@/lib/live/rules";

function outstandingOf(d: MonthDetail) {
  const owing = d.members.filter((m) => m.amountOwed > m.amountPaid);
  return {
    amount: owing.reduce((sum, m) => sum + m.amountOwed - m.amountPaid, 0),
    unpaid: owing.length,
  };
}

export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ adminToken: string }>;
  searchParams: Promise<{ practice?: string }>;
}) {
  const { adminToken } = await params;
  const { practice: practiceFlag } = await searchParams;
  const committee = await requireAdminByToken(adminToken);

  const [members, ledger, emails] = await Promise.all([
    getMembersForCommittee(committee.id),
    getCommitteeLedger(committee),
    getGoogleEmails(committee.id).catch((err) => {
      if (isLiveSchemaMissing(err)) return null;
      throw err;
    }),
  ]);
  const monthHref = (id: string) => `/admin/${adminToken}/months/${id}`;

  const recorded = ledger.filter((d) => d.month.auctionRecordedAt);
  const firstOpen = ledger.find((d) => !d.month.auctionRecordedAt);
  const later = ledger.filter((d) => !d.month.auctionRecordedAt && d !== firstOpen);
  const toCollect = recorded
    .map((d) => ({ d, ...outstandingOf(d) }))
    .filter((x) => x.unpaid > 0);
  const notJoined = emails
    ? [...members].filter((m) => !emails.has(m.id)).sort((a, b) => a.name.localeCompare(b.name))
    : [];

  return (
    <div className="mx-auto max-w-lg px-4 py-5 md:grid md:max-w-3xl md:grid-cols-2 md:items-start md:gap-6 md:py-8">
      <div className="space-y-5">
        <p className="eyebrow px-1">
          {firstOpen ? `Month ${firstOpen.month.monthNumber} of ${committee.durationMonths}` : "Season complete"} ·{" "}
          <span className="money normal-case">{formatRupees(committee.monthlyContribution * committee.memberCount)}</span> pot
        </p>

        <CommitteeDayCard committee={committee} adminToken={adminToken} />

        {(firstOpen?.isReserved || toCollect.length > 0) && (
          <section>
            <h2 className="eyebrow mb-2 px-1">To do</h2>
            <ul className="card divide-y divide-[var(--border-subtle)]">
              {firstOpen?.isReserved && (
                <TodoRow
                  href={monthHref(firstOpen.month.id)}
                  title={`Record Month ${firstOpen.month.monthNumber} · holder's month`}
                  detail="No auction. Confirm it so its payments can be collected."
                />
              )}
              {toCollect.map(({ d, amount, unpaid }) => (
                <TodoRow
                  key={d.month.id}
                  href={monthHref(d.month.id)}
                  title={`Collect Month ${d.month.monthNumber}`}
                  detail={`${unpaid} of ${d.members.length} still to pay`}
                  amount={formatRupees(amount)}
                />
              ))}
            </ul>
          </section>
        )}

        {emails && (
          <section className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="eyebrow">Joined the app</h2>
              <Link
                href={`/admin/${adminToken}/players`}
                className="-my-2 flex min-h-11 items-center text-xs font-semibold text-[var(--cloth)]"
              >
                Manage players →
              </Link>
            </div>
            <p className="money mt-1 text-2xl font-medium">
              {members.length - notJoined.length}
              <span className="text-base text-[var(--muted)]"> of {members.length}</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border-subtle)]">
              <div
                className="h-full rounded-full bg-[var(--cloth)]"
                style={{ width: `${((members.length - notJoined.length) / members.length) * 100}%` }}
              />
            </div>
            {notJoined.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--cloth)]">Everyone&apos;s in ✓</p>
            ) : (
              <>
                <p className="mt-3 text-xs font-medium text-[var(--muted)]">Not joined yet</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {notJoined.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-full border border-[var(--border-strong)] px-2.5 py-1 text-xs font-medium"
                    >
                      {m.name}
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  <ShareJoinLink committeeName={committee.name} joinCode={joinCode(committee.id)} />
                </div>
              </>
            )}
          </section>
        )}
      </div>

      <div className="mt-5 space-y-5 md:mt-0">
        <section>
          <h2 className="eyebrow mb-2 px-1">
            Season · {recorded.length} of {committee.durationMonths} done
          </h2>
          <ul className="card divide-y divide-[var(--border-subtle)]">
            {[...recorded, ...(firstOpen ? [firstOpen] : [])].map((d) => (
              <MonthRow key={d.month.id} d={d} href={monthHref(d.month.id)} isNext={d === firstOpen} />
            ))}
          </ul>
          {later.length > 0 && (
            <details className="group mt-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg px-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
                <span>
                  Months {later[0].month.monthNumber}–{later[later.length - 1].month.monthNumber} · not auctioned yet
                </span>
                <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
              </summary>
              <ul className="card mt-1 divide-y divide-[var(--border-subtle)]">
                {later.map((d) => (
                  <MonthRow key={d.month.id} d={d} href={monthHref(d.month.id)} isNext={false} />
                ))}
              </ul>
            </details>
          )}
        </section>

        <ProfitLossSummary monthlyContribution={committee.monthlyContribution} months={summarizeLedger(ledger)} />

        {!isPracticeCommittee(committee) && (
          <PracticeCard committee={committee} adminToken={adminToken} justDeleted={practiceFlag === "deleted"} />
        )}

        <p className="money px-1 text-xs text-[var(--muted)]">
          {formatRupees(committee.monthlyContribution)}/month × {committee.memberCount} members ·{" "}
          {committee.durationMonths} months · runner-up bonus {formatRupees(committee.runnerUpBonus)}
        </p>
      </div>
    </div>
  );
}

function TodoRow({ href, title, detail, amount }: { href: string; title: string; detail: string; amount?: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--background)]">
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-[var(--muted)]">{detail}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {amount && <span className="money text-sm font-semibold text-[var(--stamp)]">{amount}</span>}
          <span aria-hidden className="text-[var(--muted)]">›</span>
        </span>
      </Link>
    </li>
  );
}

function MonthRow({ d, href, isNext }: { d: MonthDetail; href: string; isNext: boolean }) {
  const { month } = d;
  const winnerId = d.isReserved ? d.holderMemberId : month.winnerMemberId;
  const winner = d.members.find((m) => m.memberId === winnerId)?.memberName;
  const due = month.auctionRecordedAt ? outstandingOf(d) : null;
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 hover:bg-[var(--background)]">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium">
            Month {month.monthNumber}
            {d.isReserved && <Stamp tone="muted">Holder</Stamp>}
          </span>
          {month.auctionRecordedAt && winner && (
            <span className="money mt-0.5 block truncate text-xs text-[var(--muted)]">
              {winner}
              {month.winningBid ? ` · bid ${formatRupees(month.winningBid)}` : ""}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right text-xs">
          {!due ? (
            isNext ? (
              <Stamp tone="brass">{d.isReserved ? "Record →" : "Up next"}</Stamp>
            ) : (
              <span className="text-[var(--muted)]">Record ›</span>
            )
          ) : due.unpaid === 0 ? (
            <Stamp tone="cloth">Collected</Stamp>
          ) : (
            <span className="money font-medium text-[var(--stamp)]">{formatRupees(due.amount)} due</span>
          )}
        </span>
      </Link>
    </li>
  );
}
