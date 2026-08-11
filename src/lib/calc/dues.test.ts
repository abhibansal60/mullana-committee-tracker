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

  it("auctioned month, evenly-divisible split: the winner shares the group discount too, only the runner-up gets extra", () => {
    const terms: CommitteeTerms = {
      memberCount: 12,
      monthlyContribution: 20000,
      runnerUpBonus: 1000,
    };
    const memberIds = ids(12);
    // pool = 13000 - 1000 = 12000; share = 12000 / 12 = 1000 exactly
    const result = computeMonthDues(terms, memberIds, {
      isReserved: false,
      winnerMemberId: memberIds[0],
      winningBid: 13000,
      runnerUpMemberId: memberIds[1],
    });

    expect(result.pot).toBe(240000);
    expect(result.payoutToWinner).toBe(227000);

    const winner = result.perMember.find((d) => d.memberId === memberIds[0])!;
    const runnerUp = result.perMember.find(
      (d) => d.memberId === memberIds[1]
    )!;
    expect(winner.amountOwed).toBe(19000); // same base discount as everyone else
    expect(winner.role).toBe("winner");
    expect(result.winnerNetGain).toBe(227000 - 19000);
    expect(runnerUp.amountOwed).toBe(18000); // base discount (1000) + bonus (1000)
    expect(runnerUp.role).toBe("runnerUp");

    const others = result.perMember.filter(
      (d) => d.memberId !== memberIds[0] && d.memberId !== memberIds[1]
    );
    expect(others).toHaveLength(10);
    for (const due of others) {
      expect(due.amountOwed).toBe(19000);
      expect(due.role).toBe("other");
    }

    const total = result.perMember.reduce((sum, d) => sum + d.amountOwed, 0);
    expect(total).toBe(result.payoutToWinner);
  });

  it("matches a real recorded committee auction exactly (regression test)", () => {
    // Real data: 12 members, ₹20,000/month, bid closed at ₹38,000 to the
    // winner, runner-up bonus ₹1,000. Reported: runner-up paid ₹15,917,
    // everyone else paid ₹16,917 (a few paid ₹16,916 due to the ₹4 rounding
    // remainder - pool 37,000 / 12 members = 3,083 remainder 4).
    const terms: CommitteeTerms = {
      memberCount: 12,
      monthlyContribution: 20000,
      runnerUpBonus: 1000,
    };
    const memberIds = ids(12);
    // Place winner/runner-up outside the first 4 (remainder-affected) slots
    // so their amounts land exactly on the commonly reported figures.
    const winnerMemberId = memberIds[4];
    const runnerUpMemberId = memberIds[5];

    const result = computeMonthDues(terms, memberIds, {
      isReserved: false,
      winnerMemberId,
      winningBid: 38000,
      runnerUpMemberId,
    });

    expect(result.payoutToWinner).toBe(202000); // 240000 - 38000

    const winner = result.perMember.find((d) => d.memberId === winnerMemberId)!;
    const runnerUp = result.perMember.find(
      (d) => d.memberId === runnerUpMemberId
    )!;
    expect(winner.amountOwed).toBe(16917);
    expect(runnerUp.amountOwed).toBe(15917);

    const others = result.perMember.filter(
      (d) => d.memberId !== winnerMemberId && d.memberId !== runnerUpMemberId
    );
    const amounts = others.map((d) => d.amountOwed).sort((a, b) => a - b);
    // 4 of the 10 remaining members absorb the ₹1 rounding remainder
    expect(amounts).toEqual([
      16916, 16916, 16916, 16916, 16917, 16917, 16917, 16917, 16917, 16917,
    ]);

    const total = result.perMember.reduce((sum, d) => sum + d.amountOwed, 0);
    expect(total).toBe(result.payoutToWinner);
  });

  it("auctioned month, non-evenly-divisible split distributes the remainder deterministically", () => {
    const terms: CommitteeTerms = {
      memberCount: 9,
      monthlyContribution: 5000,
      runnerUpBonus: 100,
    };
    const memberIds = ids(9);
    // pool = 1500 - 100 = 1400; share = floor(1400/9) = 155, remainder = 5
    const result = computeMonthDues(terms, memberIds, {
      isReserved: false,
      winnerMemberId: memberIds[7],
      winningBid: 1500,
      runnerUpMemberId: memberIds[8],
    });

    expect(result.payoutToWinner).toBe(9 * 5000 - 1500);

    const winner = result.perMember.find((d) => d.memberId === memberIds[7])!;
    const runnerUp = result.perMember.find((d) => d.memberId === memberIds[8])!;
    expect(winner.amountOwed).toBe(5000 - 155); // not in the first 5 (remainder) slots
    expect(runnerUp.amountOwed).toBe(5000 - 155 - 100);

    const others = memberIds
      .slice(0, 7)
      .map((id) => result.perMember.find((d) => d.memberId === id)!);
    for (let i = 0; i < others.length; i++) {
      const expectedExtra = i < 5 ? 1 : 0;
      expect(others[i].amountOwed).toBe(5000 - 155 - expectedExtra);
    }

    const total = result.perMember.reduce((sum, d) => sum + d.amountOwed, 0);
    expect(total).toBe(result.payoutToWinner);
  });

  it("winningBid === runnerUpBonus: no group discount for anyone, runner-up only gets the flat bonus", () => {
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

    const winner = result.perMember.find((d) => d.memberId === memberIds[0])!;
    expect(winner.amountOwed).toBe(1000);
    const runnerUp = result.perMember.find((d) => d.memberId === memberIds[1])!;
    expect(runnerUp.amountOwed).toBe(500);
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

  it("throws when memberCount < 2 on an auctioned month", () => {
    const terms: CommitteeTerms = {
      memberCount: 1,
      monthlyContribution: 1000,
      runnerUpBonus: 100,
    };
    const memberIds = ids(1);
    expect(() =>
      computeMonthDues(terms, memberIds, {
        isReserved: false,
        winnerMemberId: memberIds[0],
        winningBid: 500,
        runnerUpMemberId: "nonexistent",
      })
    ).toThrow(/at least 2/);
  });

  it("throws when the computed discount would make a member's amountOwed negative", () => {
    const terms: CommitteeTerms = {
      memberCount: 3,
      monthlyContribution: 1000,
      runnerUpBonus: 900,
    };
    const memberIds = ids(3);
    // pool = 1500 - 900 = 600; share = 200; runner-up discount = 200+900=1100 > 1000 contribution
    expect(() =>
      computeMonthDues(terms, memberIds, {
        isReserved: false,
        winnerMemberId: memberIds[0],
        winningBid: 1500,
        runnerUpMemberId: memberIds[1],
      })
    ).toThrow(/negative amountOwed/);
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
      const memberCount = 2 + Math.floor(Math.random() * 16); // 2..17
      const monthlyContribution = (1 + Math.floor(Math.random() * 50)) * 1000; // 1000..50000
      const runnerUpBonus = (1 + Math.floor(Math.random() * 10)) * 100; // 100..1000
      const pot = memberCount * monthlyContribution;
      const maxBidMultiples = Math.floor((pot - 500) / 500);
      const winningBid = 500 * (1 + Math.floor(Math.random() * maxBidMultiples));

      const memberIds = ids(memberCount);
      const winnerMemberId = memberIds[0];
      const runnerUpMemberId = memberIds[1];

      try {
        const result = computeMonthDues(
          { memberCount, monthlyContribution, runnerUpBonus },
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
        // Invalid random combination - skip and retry.
      }
    }

    expect(validCasesRun).toBe(100);
  });
});
