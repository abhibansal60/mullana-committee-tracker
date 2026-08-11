import { describe, expect, test } from "vitest";
import { computeMonthProfitOrLoss, computeRunningProfitOrLoss } from "./pnl";

describe("computeMonthProfitOrLoss", () => {
  test("a bid above the monthly contribution is a loss", () => {
    // matches a real hand-tallied example: bid 16,500 against a 9,327
    // baseline was recorded as "7173 loss"
    expect(
      computeMonthProfitOrLoss(9327, { isReserved: false, winningBid: 16500 })
    ).toBe(-7173);
  });

  test("a bid below the monthly contribution is a profit", () => {
    expect(
      computeMonthProfitOrLoss(9327, { isReserved: false, winningBid: 5000 })
    ).toBe(4327);
  });

  test("a bid exactly equal to the monthly contribution is break-even", () => {
    expect(
      computeMonthProfitOrLoss(20000, { isReserved: false, winningBid: 20000 })
    ).toBe(0);
  });

  test("the reserved month is always zero, regardless of winningBid", () => {
    expect(
      computeMonthProfitOrLoss(20000, { isReserved: true, winningBid: null })
    ).toBe(0);
    expect(
      computeMonthProfitOrLoss(20000, { isReserved: true, winningBid: 5000 })
    ).toBe(0);
  });

  test("a month with no bid yet recorded is zero", () => {
    expect(
      computeMonthProfitOrLoss(20000, { isReserved: false, winningBid: null })
    ).toBe(0);
  });
});

describe("computeRunningProfitOrLoss", () => {
  test("sums profit/loss across months, letting later profits offset earlier losses", () => {
    const months = [
      { isReserved: false, winningBid: 16500 }, // -7173
      { isReserved: true, winningBid: null }, // 0
      { isReserved: false, winningBid: 5000 }, // +4327
    ];
    expect(computeRunningProfitOrLoss(9327, months)).toBe(-7173 + 0 + 4327);
  });

  test("empty committee (no months recorded yet) is zero", () => {
    expect(computeRunningProfitOrLoss(20000, [])).toBe(0);
  });
});
