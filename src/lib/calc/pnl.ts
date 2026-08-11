export interface MonthBidFigure {
  isReserved: boolean;
  winningBid: number | null; // null when reserved or not yet auctioned
}

/**
 * Collective profit/loss for one month, relative to a flat "everyone just
 * pays the monthly contribution, nobody bids" baseline.
 *
 * A high winning bid gives away a large discount to the group (loss); a low
 * bid keeps more in the pot than the baseline would (profit). The reserved
 * month has no auction, so it never contributes either way.
 *
 * This is intentionally a single committee-wide figure, not a per-member
 * one - the pot is shared, so "did this month's auction cost the group
 * money or save it" is the same question for everyone in the committee.
 */
export function computeMonthProfitOrLoss(
  monthlyContribution: number,
  month: MonthBidFigure
): number {
  if (month.isReserved || month.winningBid == null) return 0;
  return monthlyContribution - month.winningBid;
}

/** Cumulative profit/loss across every recorded month so far. */
export function computeRunningProfitOrLoss(
  monthlyContribution: number,
  months: MonthBidFigure[]
): number {
  return months.reduce(
    (sum, m) => sum + computeMonthProfitOrLoss(monthlyContribution, m),
    0
  );
}
