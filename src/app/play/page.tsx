import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCommitteeLedger } from "@/lib/db/queries";
import { getCurrentPlayer, getDisplaySession, isLiveSchemaMissing } from "@/lib/live/queries";
import { db } from "@/lib/db";
import { months as monthsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatRupees } from "@/lib/money";
import Avatar, { initials } from "@/components/live/Avatar";
import StatusBadge from "@/components/StatusBadge";
import Stamp from "@/components/Stamp";
import LiveBanner from "@/components/play/LiveBanner";
import LogoutLink from "./LogoutLink";

export const metadata: Metadata = { title: "My passbook · Committee" };

export default async function PlayHomePage({ searchParams }: PageProps<"/play">) {
  const player = await getCurrentPlayer();
  if (!player) redirect("/login");
  const { committee, member } = player;
  const { welcome } = await searchParams;

  const [ledger, session] = await Promise.all([
    getCommitteeLedger(committee),
    getDisplaySession(committee.id).catch((err) => {
      if (isLiveSchemaMissing(err)) return null;
      throw err;
    }),
  ]);

  let sessionMonthNumber: number | null = null;
  if (session) {
    const row = await db
      .select({ monthNumber: monthsTable.monthNumber })
      .from(monthsTable)
      .where(eq(monthsTable.id, session.monthId))
      .limit(1);
    sessionMonthNumber = row[0]?.monthNumber ?? null;
  }

  const recorded = ledger.filter((d) => d.month.auctionRecordedAt && d.dues);
  const winnerOf = (d: (typeof ledger)[number]) =>
    d.isReserved ? d.holderMemberId : d.month.winnerMemberId;
  const nameOf = (id: string | null | undefined) =>
    ledger[0]?.members.find((m) => m.memberId === id)?.memberName ?? "—";

  const myWin = recorded.find((d) => winnerOf(d) === member.id);
  const latest = recorded[recorded.length - 1];
  const myLatest = latest?.members.find((m) => m.memberId === member.id);
  const nextMonth = ledger.find((d) => !d.month.auctionRecordedAt);
  const monthsLeft = ledger.filter((d) => !d.month.auctionRecordedAt && !d.isReserved).length;
  const totalPaid = recorded.reduce(
    (sum, d) => sum + (d.members.find((m) => m.memberId === member.id)?.amountPaid ?? 0),
    0
  );
  const outstanding = recorded.reduce((sum, d) => {
    const m = d.members.find((x) => x.memberId === member.id);
    return sum + Math.max(0, (m?.amountOwed ?? 0) - (m?.amountPaid ?? 0));
  }, 0);
  const firstName = member.name.split(" ")[0];

  return (
    <div className="min-h-dvh pb-16">
      <header className="bg-spine">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3.5">
          <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold text-spine-foreground">
            {committee.name}
          </span>
          <div className="flex items-center gap-3">
            <LogoutLink />
            <Avatar name={member.name} size={30} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-5 pt-6">
        {welcome && (
          <p className="rounded-xl border border-[var(--cloth)] bg-[var(--cloth-tint)] px-4 py-3 text-sm text-[var(--cloth)]">
            You&apos;re logged in for the whole committee year on this phone. 🎉
          </p>
        )}

        <LiveBanner
          initial={{
            status: session?.status ?? null,
            monthNumber: sessionMonthNumber,
            here: 0,
          }}
        />

        {/* Hero: who I am in this committee */}
        <section className="arena-bg overflow-hidden rounded-2xl p-5 shadow-lg">
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--gold)] uppercase">Namaste</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold">{firstName}</h1>
          {member.isHolder ? (
            <p className="mt-2 text-sm text-[var(--arena-muted)]">
              You run this committee. Open the auction room from your admin link.
            </p>
          ) : myWin ? (
            <p className="mt-2 text-sm text-[var(--arena-muted)]">
              🏆 You won <b className="text-[var(--arena-text)]">Month {myWin.month.monthNumber}</b> and took home{" "}
              <b className="money text-[var(--gold)]">{formatRupees(myWin.dues!.payoutToWinner)}</b>. Watch & cheer the rest!
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--arena-muted)]">
              🏁 Still in the race — <b className="text-[var(--arena-text)]">{monthsLeft}</b> auction
              {monthsLeft === 1 ? "" : "s"} left for you to win.
            </p>
          )}

          {/* Season track */}
          <div className="mt-6">
            <div className="mb-2 flex items-baseline justify-between text-xs text-[var(--arena-muted)]">
              <span>The season</span>
              <span className="money">
                {recorded.length}/{committee.durationMonths} done
              </span>
            </div>
            <ol className="grid grid-cols-6 gap-2 sm:grid-cols-12">
              {ledger.map((d) => {
                const done = !!d.month.auctionRecordedAt;
                const winner = done ? winnerOf(d) : null;
                const mine = winner === member.id;
                const isNext = d.month.id === nextMonth?.month.id;
                return (
                  <li key={d.month.id} className="flex flex-col items-center gap-1">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold ${
                        mine
                          ? "bg-[var(--gold)] text-[#1b1203] ring-2 ring-[var(--gold)] ring-offset-2 ring-offset-[var(--arena)]"
                          : done
                            ? "bg-[var(--arena-line)] text-[var(--arena-text)]"
                            : isNext
                              ? "animate-live-pulse border-2 border-[var(--ember)] text-[var(--ember)]"
                              : "border border-dashed border-[var(--arena-line)] text-[var(--arena-muted)]"
                      }`}
                      title={done ? `Month ${d.month.monthNumber}: ${nameOf(winner)}` : `Month ${d.month.monthNumber}`}
                    >
                      {done ? (mine ? "★" : initials(nameOf(winner))) : d.month.monthNumber}
                    </span>
                    <span className="text-[9px] text-[var(--arena-muted)]">
                      {d.isReserved ? "H" : `M${d.month.monthNumber}`}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* Money at a glance */}
        {latest && myLatest && (
          <section className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="eyebrow">Month {latest.month.monthNumber} · your contribution</span>
                <p className="money mt-1 text-3xl font-medium">{formatRupees(myLatest.amountOwed)}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {myLatest.amountOwed < committee.monthlyContribution
                    ? `${formatRupees(committee.monthlyContribution - myLatest.amountOwed)} less than usual`
                    : "Full contribution"}
                  {myLatest.amountPaid > 0 && ` · paid ${formatRupees(myLatest.amountPaid)}`}
                </p>
              </div>
              <StatusBadge status={myLatest.status} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-4">
              <div>
                <span className="eyebrow">Paid so far</span>
                <p className="money mt-0.5 text-lg">{formatRupees(totalPaid)}</p>
              </div>
              <div>
                <span className="eyebrow">Outstanding</span>
                <p className={`money mt-0.5 text-lg ${outstanding > 0 ? "text-[var(--stamp)]" : "text-[var(--cloth)]"}`}>
                  {outstanding > 0 ? formatRupees(outstanding) : "All clear ✓"}
                </p>
              </div>
            </div>
          </section>
        )}

        {nextMonth && !session && (
          <section className="card flex items-center gap-4 p-5">
            <span className="text-3xl">🗓️</span>
            <div>
              <p className="font-medium">
                Next up: Month {nextMonth.month.monthNumber}
                {nextMonth.isReserved ? " (holder's month — no auction)" : ""}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {nextMonth.isReserved
                  ? "The holder takes this pot. No bidding needed."
                  : "When the holder opens the room, this screen lights up. Bid right from here."}
              </p>
            </div>
          </section>
        )}

        {/* Winners wall */}
        {recorded.length > 0 && (
          <section>
            <h2 className="eyebrow mb-2 px-1">Winners so far</h2>
            <ul className="card divide-y divide-[var(--border-subtle)] px-4">
              {[...recorded].reverse().map((d) => {
                const winnerId = winnerOf(d);
                return (
                  <li key={d.month.id} className="flex items-center gap-3 py-3">
                    <Avatar name={nameOf(winnerId)} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {winnerId === member.id ? "You" : nameOf(winnerId)}
                        {d.isReserved && <Stamp tone="muted">Holder</Stamp>}
                      </p>
                      <p className="money text-xs text-[var(--muted)]">
                        Month {d.month.monthNumber}
                        {d.month.winningBid ? ` · bid ${formatRupees(d.month.winningBid)}` : ""}
                      </p>
                    </div>
                    <span className="money text-sm font-medium">{formatRupees(d.dues!.payoutToWinner)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* My passbook */}
        {recorded.length > 0 && (
          <section>
            <h2 className="eyebrow mb-2 px-1">My passbook</h2>
            <ul className="card divide-y divide-[var(--border-subtle)] px-4">
              {recorded.map((d) => {
                const m = d.members.find((x) => x.memberId === member.id)!;
                return (
                  <li key={d.month.id} className="ledger-row flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">Month {d.month.monthNumber}</p>
                      <p className="money text-xs text-[var(--muted)]">
                        Owed {formatRupees(m.amountOwed)} · Paid {formatRupees(m.amountPaid)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.role === "winner" && <Stamp tone="brass">Won</Stamp>}
                      {m.role === "runnerUp" && <Stamp tone="carbon">Runner-up</Stamp>}
                      <StatusBadge status={m.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

