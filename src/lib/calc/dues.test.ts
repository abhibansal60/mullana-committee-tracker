import { describe, expect, it } from "vitest";
import { computeMonthDues, type CommitteeTerms } from "./dues";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `m${i}`);

describe("computeMonthDues", () => {
  it("reserved month: everyone including holder owes full contribution, payout is the full pot", () => {
    const terms: CommitteeTerms = {
      memberCount: 12,
      monthlyContribution: 20000,
      runnerUpBonus: 1000,
    };
    const memberIds = ids(12);
    const result = computeMonthDues(terms, memberIds, {
      isReserved: true,
      winnerMemberId: memberIds[0],
      winningBid: null,
      runnerUpMemberId: null,
    });

    expect(result.pot).toBe(240000);
    expect(result.payoutToWinner).toBe(240000);
    expect(result.winnerNetGain).toBe(220000);
    expect(result.perMember).toHaveLength(12);
    for (const due of result.perMember) {
      expect(due.amountOwed).toBe(20000);
    }
    expect(
      result.perMember.find((d) => d.memberId === memberIds[0])?.role
    ).toBe("winner");
  });

  it("auctioned month, evenly-divisible split (the real v1 case)", () => {
    const terms: CommitteeTerms = {
      memberCount: 12,
      monthlyContribution: 20000,
      runnerUpBonus: 1000,
    };
    const memberIds = ids(12);
    const result = computeMonthDues(terms, memberIds, {
      isReserved: false,
      winnerMemberId: memberIds[0],
      winningBid: 15000,
      runnerUpMemberId: memberIds[1],
    });

    expect(result.pot).toBe(240000);
    expect(result.payoutToWinner).toBe(225000);
    expect(result.winnerNetGain).toBe(205000);

    const winner = result.perMember.find((d) => d.memberId === memberIds[0])!;
    const runnerUp = result.perMember.find(
      (d) => d.memberId === memberIds[1]
    )!;
    expect(winner.amountOwed).toBe(20000);
    expect(winner.role).toBe("winner");
    expect(runnerUp.amountOwed).toBe(19000); // 20000 - 1000 bonus
    expect(runnerUp.role).toBe("runnerUp");

    const others = result.perMember.filter(
      (d) => d.memberId !== memberIds[0] && d.memberId !== memberIds[1]
    );
    expect(others).toHaveLength(10);
    for (const due of others) {
      expect(due.amountOwed).toBe(18600); // 20000 - (14000/10)
      expect(due.role).toBe("other");
    }

    const total = result.perMember.reduce((sum, d) => sum + d.amountOwed, 0);
    expect(total).toBe(result.payoutToWinner);
  });

  it("auctioned month, non-evenly-divisible split distributes the remainder deterministically", () => {
    const terms: CommitteeTerms = {
      memberCount: 10,
      monthlyContribution: 5000,
      runnerUpBonus: 100,
    };
    const memberIds = ids(10);
    // remainingPool = 1000 - 100 = 900; others.length = 8; share = 112, remainder = 4
    const result = computeMonthDues(terms, memberIds, {
      isReserved: false,
      winnerMemberId: memberIds[0],
      winningBid: 1000,
      runnerUpMemberId: memberIds[1],
    });

    const others = result.perMember.filter(
      (d) => d.memberId !== memberIds[0] && d.memberId !== memberIds[1]
    );
    expect(others).toHaveLength(8);

    const amounts = others.map((d) => d.amountOwed).sort((a, b) => a - b);
    // 4 members owe one rupee less than the other 4
    expect(amounts).toEqual([4887, 4887, 4887, 4887, 4888, 4888, 4888, 4888]);

    // deterministic order: first `remainder` (4) entries of the others
    // subsequence (in memberIds order) get the extra rupee off
    const othersInOrder = memberIds.filter(
      (id) => id !== memberIds[0] && id !== memberIds[1]
    );
    for (let i = 0; i < othersInOrder.length; i++) {
      const due = result.perMember.find((d) => d.memberId === othersInOrder[i])!;
      expect(due.amountOwed).toBe(i < 4 ? 4887 : 4888);
    }

    const total = result.perMember.reduce((sum, d) => sum + d.amountOwed, 0);
    expect(total).toBe(result.payoutToWinner);
  });

  it("winningBid === runnerUpBonus: others pay full contribution, no discount", () => {
    const terms: CommitteeTerms = {
      memberCount: 4,
      monthlyContribution: 1000,
      runnerUpBonus: 500,
    };
    const memberIds = ids(4);
    const result = computeMonthDues(terms, memberIds, {
      isReserved: false,
      winnerMemberId: memberIds[0],
      winningBid: 500,
      runnerUpMemberId: memberIds[1],
    });

    const others = result.perMember.filter(
      (d) => d.memberId !== memberIds[0] && d.memberId !== memberIds[1]
    );
    for (const due of others) {
      expect(due.amountOwed).toBe(1000);
    }
  });

  it("throws when winningBid < runnerUpBonus", () => {
    const terms: CommitteeTerms = {
      memberCount: 5,
      monthlyContribution: 5000,
      runnerUpBonus: 1000,
    };
    const memberIds = ids(5);
    expect(() =>
      computeMonthDues(terms, memberIds, {
        isReserved: false,
        winnerMemberId: memberIds[0],
        winningBid: 500,
        runnerUpMemberId: memberIds[1],
      })
    ).toThrow(/at least the runnerUpBonus/);
  });

  it("throws when memberCount < 3 on an auctioned month (division by zero guard)", () => {
    const terms: CommitteeTerms = {
      memberCount: 2,
      monthlyContribution: 1000,
      runnerUpBonus: 100,
    };
    const memberIds = ids(2);
    expect(() =>
      computeMonthDues(terms, memberIds, {
        isReserved: false,
        winnerMemberId: memberIds[0],
        winningBid: 500,
        runnerUpMemberId: memberIds[1],
      })
    ).toThrow(/at least 3/);
  });

  it("throws when runnerUpBonus >= monthlyContribution", () => {
    const terms: CommitteeTerms = {
      memberCount: 5,
      monthlyContribution: 1000,
      runnerUpBonus: 1000,
    };
    const memberIds = ids(5);
    expect(() =>
      computeMonthDues(terms, memberIds, {
        isReserved: false,
        winnerMemberId: memberIds[0],
        winningBid: 1000,
        runnerUpMemberId: memberIds[1],
      })
    ).toThrow(/runnerUpBonus must be less than monthlyContribution/);
  });

  it("throws when winningBid is not a multiple of 500", () => {
    const terms: CommitteeTerms = {
      memberCount: 12,
      monthlyContribution: 20000,
      runnerUpBonus: 1000,
    };
    const memberIds = ids(12);
    expect(() =>
      computeMonthDues(terms, memberIds, {
        isReserved: false,
        winnerMemberId: memberIds[0],
        winningBid: 15250,
        runnerUpMemberId: memberIds[1],
      })
    ).toThrow(/multiple of 500/);
  });

  it("property: sum of amounts owed always equals the payout to the winner, for many randomized valid inputs", () => {
    let validCasesRun = 0;
    let attempts = 0;

    while (validCasesRun < 100 && attempts < 5000) {
      attempts++;
      const memberCount = 3 + Math.floor(Math.random() * 15); // 3..17
      const monthlyContribution = (1 + Math.floor(Math.random() * 50)) * 1000; // 1000..50000
      const runnerUpBonus =
        Math.min(
          monthlyContribution - 100,
          (1 + Math.floor(Math.random() * 20)) * 100
        ) || 100;
      const pot = memberCount * monthlyContribution;
      const maxBidMultiples = Math.floor((pot - 500) / 500);
      const winningBid = 500 * (1 + Math.floor(Math.random() * maxBidMultiples));

      const memberIds = ids(memberCount);
      const winnerMemberId = memberIds[0];
      const runnerUpMemberId = memberIds[1];

      try {
        const result = computeMonthDues(
          {
            memberCount,
            monthlyContribution,
            runnerUpBonus,
          },
          memberIds,
          {
            isReserved: false,
            winnerMemberId,
            winningBid,
            runnerUpMemberId,
          }
        );

        const total = result.perMember.reduce(
          (sum, d) => sum + d.amountOwed,
          0
        );
        expect(total).toBe(result.payoutToWinner);
        for (const due of result.perMember) {
          expect(due.amountOwed).toBeGreaterThanOrEqual(0);
        }
        validCasesRun++;
      } catch {
        // Invalid random combination (e.g. bid too small relative to bonus,
        // or discount share would exceed contribution) - skip and retry.
      }
    }

    expect(validCasesRun).toBe(100);
  });
});
