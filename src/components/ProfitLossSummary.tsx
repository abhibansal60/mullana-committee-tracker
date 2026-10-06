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

  const sign = (n: number) => `${n >= 0 ? "+" : "−"}${formatRupees(Math.abs(n))}`;

  return (
    <details className="group card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span>
          <span className="eyebrow block">Profit &amp; loss</span>
          <span className="text-xs text-[var(--muted)]">Running total so far</span>
        </span>
        <span className="flex items-center gap-2">
          <span
            className={`money text-lg font-medium ${
              runningIsProfit ? "text-[var(--cloth)]" : "text-[var(--stamp)]"
            }`}
          >
            {sign(running)}
          </span>
          <span aria-hidden className="text-[var(--muted)] transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>

      <div className="border-t border-[var(--border-subtle)] px-4 pb-1">
        <p className="pt-3 text-xs text-[var(--muted)]">
          Each month compares the winning bid to the flat{" "}
          {formatRupees(monthlyContribution)} contribution. A high bid gives
          away a bigger discount (a loss for the pot); a low bid keeps more
          in it (a profit) &mdash; later months can pull the total back up.
        </p>
        <ul className="mt-2 divide-y divide-[var(--border-subtle)]">
          {auctionedMonths.map((m) => {
            const figure = computeMonthProfitOrLoss(monthlyContribution, m);
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
                    figure >= 0 ? "text-[var(--cloth)]" : "text-[var(--stamp)]"
                  }`}
                >
                  {sign(figure)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
