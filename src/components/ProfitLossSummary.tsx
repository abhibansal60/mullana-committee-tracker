import { computeMonthProfitOrLoss, computeRunningProfitOrLoss } from "@/lib/calc/pnl";
import { formatRupees } from "@/lib/money";
import type { MonthSummary } from "@/lib/db/queries";

/**
 * Shared by both the holder's dashboard and the member's read-only
 * dashboard - this is a committee-wide figure (how the pot did against a
 * flat-payment baseline), not a per-member one, so everyone sees the same
 * numbers.
 */
export default function ProfitLossSummary({
  monthlyContribution,
  months,
}: {
  monthlyContribution: number;
  months: MonthSummary[];
}) {
  const auctionedMonths = months.filter(
    (m) => m.auctionRecordedAt && !m.isReserved
  );
  if (auctionedMonths.length === 0) return null;

  const running = computeRunningProfitOrLoss(monthlyContribution, months);
  const runningIsProfit = running >= 0;

  return (
    <section>
      <h2 className="eyebrow mb-2 px-1">Profit &amp; loss</h2>

      <div className="card p-5">
        <span className="eyebrow">Running total so far</span>
        <p
          className={`money mt-1 text-2xl font-medium ${
            runningIsProfit ? "text-[var(--cloth)]" : "text-[var(--stamp)]"
          }`}
        >
          {runningIsProfit ? "+" : "−"}
          {formatRupees(Math.abs(running))}
        </p>
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          Each month compares the winning bid to the flat{" "}
          {formatRupees(monthlyContribution)} contribution. A high bid gives
          away a bigger discount (a loss for the pot); a low bid keeps more
          in it (a profit) &mdash; later months can pull the total back up.
        </p>
      </div>

      <ul className="card mt-3 divide-y divide-[var(--border-subtle)] px-4">
        {auctionedMonths.map((m) => {
          const figure = computeMonthProfitOrLoss(monthlyContribution, m);
          const isProfit = figure >= 0;
          return (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <span>
                Month {m.monthNumber}
                {m.winnerName && (
                  <span className="block text-xs text-[var(--muted)]">
                    {m.winnerName}
                  </span>
                )}
              </span>
              <span
                className={`money font-medium ${
                  isProfit ? "text-[var(--cloth)]" : "text-[var(--stamp)]"
                }`}
              >
                {isProfit ? "+" : "−"}
                {formatRupees(Math.abs(figure))}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
