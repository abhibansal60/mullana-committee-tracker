import { describe, expect, it } from "vitest";
import { computeMonthDues } from "@/lib/calc/dues";
import {
  clockPhase,
  computeMaxBid,
  defaultLiveSettings,
  jumpBidOptions,
  minOpeningBid,
  nextBidAmount,
  normalizePhone,
  standingsFromBids,
  validateBidAmount,
  validateLiveSettings,
} from "./rules";

// The real committee: 12 members x ₹10,000, ₹1,000 runner-up bonus.
const terms = { memberCount: 12, monthlyContribution: 10000, runnerUpBonus: 1000 };

describe("normalizePhone", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["98765 43210", "9876543210"],
    ["+91 98765-43210", "9876543210"],
    ["919876543210", "9876543210"],
    ["09876543210", "9876543210"],
  ])("accepts %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "5876543210", "98765432100000", "abc"])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("computeMaxBid", () => {
  it("returns a bid computeMonthDues accepts, and the next step up is rejected", () => {
    const max = computeMaxBid(terms);
    const ids = Array.from({ length: 12 }, (_, i) => `m${i}`);
    const run = (bid: number) =>
      computeMonthDues(terms, ids, {
        isReserved: false,
        winnerMemberId: ids[0],
        winningBid: bid,
        runnerUpMemberId: ids[11],
      });
    expect(() => run(max)).not.toThrow();
    expect(() => run(max + 500)).toThrow();
    expect(max % 500).toBe(0);
  });

  it("stays below the pot", () => {
    expect(computeMaxBid(terms)).toBeLessThan(120000);
  });
});

describe("validateLiveSettings", () => {
  const ok = { openingBid: 10000, bidIncrement: 500, roundSeconds: 30 };

  it("accepts sensible settings", () => {
    expect(validateLiveSettings(terms, ok)).toBeNull();
    expect(validateLiveSettings(terms, { ...ok, bidIncrement: 1000 })).toBeNull();
  });

  it("rejects a step that isn't a multiple of 500", () => {
    expect(validateLiveSettings(terms, { ...ok, bidIncrement: 750 })).toMatch(/multiple/);
  });

  it("rejects an opening bid below the runner-up bonus", () => {
    expect(validateLiveSettings(terms, { ...ok, openingBid: 500 })).toMatch(/at least/);
  });

  it("rejects an opening bid above the max", () => {
    expect(
      validateLiveSettings(terms, { ...ok, openingBid: computeMaxBid(terms) + 500 })
    ).toMatch(/at most/);
  });

  it("rejects out-of-range timers", () => {
    expect(validateLiveSettings(terms, { ...ok, roundSeconds: 5 })).toMatch(/Timer/);
    expect(validateLiveSettings(terms, { ...ok, roundSeconds: 500 })).toMatch(/Timer/);
  });

  it("defaults are themselves valid", () => {
    expect(validateLiveSettings(terms, defaultLiveSettings(terms))).toBeNull();
  });
});

describe("minOpeningBid", () => {
  it("is the runner-up bonus rounded up to a 500 step", () => {
    expect(minOpeningBid(terms)).toBe(1000);
    expect(minOpeningBid({ ...terms, runnerUpBonus: 1200 })).toBe(1500);
    expect(minOpeningBid({ ...terms, runnerUpBonus: 0 })).toBe(500);
  });
});

describe("bidding", () => {
  const fresh = { currentBid: null, openingBid: 10000, bidIncrement: 500 };
  const running = { currentBid: 12000, openingBid: 10000, bidIncrement: 1000 };
  const max = computeMaxBid(terms);

  it("first bid is the opening bid, then current + step", () => {
    expect(nextBidAmount(fresh)).toBe(10000);
    expect(nextBidAmount(running)).toBe(13000);
  });

  it("validates bid amounts", () => {
    expect(validateBidAmount(running, 13000, max)).toBeNull();
    expect(validateBidAmount(running, 15000, max)).toBeNull(); // jump bid
    expect(validateBidAmount(running, 12500, max)).toMatch(/at least/);
    expect(validateBidAmount(running, 13250, max)).toMatch(/steps/);
    expect(validateBidAmount(running, max + 500, max)).toMatch(/above/);
  });

  it("jump options never exceed the max", () => {
    expect(jumpBidOptions(running, max)).toEqual([13000, 14000, 16000]);
    expect(jumpBidOptions({ ...running, currentBid: max - 1000 }, max)).toEqual([max]);
  });
});

describe("clockPhase", () => {
  it("walks open -> going once -> going twice -> sold", () => {
    expect(clockPhase(30000, 30)).toBe("open");
    expect(clockPhase(19000, 30)).toBe("going-once");
    expect(clockPhase(9000, 30)).toBe("going-twice");
    expect(clockPhase(0, 30)).toBe("sold");
  });

  it("skips going-once on very short rounds", () => {
    expect(clockPhase(8000, 10)).toBe("open");
    expect(clockPhase(3000, 10)).toBe("going-twice");
  });
});

describe("standingsFromBids", () => {
  it("is empty with no bids", () => {
    expect(standingsFromBids([])).toEqual({ leaderId: null, runnerUpId: null, currentBid: null });
  });

  it("has no runner-up after a single bid", () => {
    expect(standingsFromBids([{ memberId: "a", amount: 10000 }])).toEqual({
      leaderId: "a",
      runnerUpId: null,
      currentBid: 10000,
    });
  });

  it("runner-up is the last bidder the leader had to beat", () => {
    expect(
      standingsFromBids([
        { memberId: "a", amount: 10000 },
        { memberId: "b", amount: 10500 },
        { memberId: "c", amount: 11000 },
        { memberId: "b", amount: 11500 },
      ])
    ).toEqual({ leaderId: "b", runnerUpId: "c", currentBid: 11500 });
  });
});
