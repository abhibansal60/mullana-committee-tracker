export interface CommitteeTerms {
  memberCount: number; // N
  monthlyContribution: number; // rupees, per member per month
  runnerUpBonus: number; // rupees, configurable per committee (default 1000)
}

export interface MonthAuctionResult {
  isReserved: boolean; // caller computes: monthNumber === committee.reservedMonthNumber
  winnerMemberId: string; // for reserved month, must equal the holder's member id
  winningBid: number | null; // null/ignored when isReserved; must be a multiple of 500 otherwise
  runnerUpMemberId: string | null; // null when isReserved
}

export interface MemberDue {
  memberId: string;
  amountOwed: number; // rupees, integer, >= 0
  role: "winner" | "runnerUp" | "other";
}

export interface MonthDuesResult {
  pot: number; // memberCount * monthlyContribution
  payoutToWinner: number; // pot - winningBid (or pot, for reserved month)
  winnerNetGain: number; // payoutToWinner - winner's amountOwed
  perMember: MemberDue[]; // one entry per id in memberIds, same order
}

/**
 * Pure calculation, no DB access. Throws Error on invalid/impossible input.
 *
 * Contract: `memberIds` must be passed in a STABLE order (e.g. members.sortOrder
 * ascending). When the discount pool doesn't divide evenly across the "other"
 * members, the leftover 1-rupee increments are assigned to the FIRST `remainder`
 * entries of the (winner/runnerUp-excluded) subsequence of `memberIds`, in the
 * order given. This is deterministic and depended on by tests/callers.
 */
export function computeMonthDues(
  terms: CommitteeTerms,
  memberIds: string[],
  auction: MonthAuctionResult
): MonthDuesResult {
  const { memberCount, monthlyContribution, runnerUpBonus } = terms;

  if (memberIds.length !== memberCount) {
    throw new Error(
      `memberIds length (${memberIds.length}) must equal memberCount (${memberCount})`
    );
  }
  if (new Set(memberIds).size !== memberIds.length) {
    throw new Error("memberIds must not contain duplicates");
  }
  if (!memberIds.includes(auction.winnerMemberId)) {
    throw new Error("winnerMemberId must be one of memberIds");
  }

  const pot = memberCount * monthlyContribution;

  if (auction.isReserved) {
    if (auction.winningBid !== null || auction.runnerUpMemberId !== null) {
      throw new Error(
        "Reserved month must not have a winningBid or runnerUpMemberId"
      );
    }
    const perMember: MemberDue[] = memberIds.map((memberId) => ({
      memberId,
      amountOwed: monthlyContribution,
      role: memberId === auction.winnerMemberId ? "winner" : "other",
    }));
    const payoutToWinner = pot;
    const winnerAmountOwed = monthlyContribution;
    return {
      pot,
      payoutToWinner,
      winnerNetGain: payoutToWinner - winnerAmountOwed,
      perMember,
    };
  }

  const { winningBid, runnerUpMemberId } = auction;

  if (runnerUpMemberId === null) {
    throw new Error("Auctioned month requires a runnerUpMemberId");
  }
  if (runnerUpMemberId === auction.winnerMemberId) {
    throw new Error("winnerMemberId and runnerUpMemberId must differ");
  }
  if (!memberIds.includes(runnerUpMemberId)) {
    throw new Error("runnerUpMemberId must be one of memberIds");
  }
  if (winningBid === null) {
    throw new Error("Auctioned month requires a winningBid");
  }
  if (winningBid <= 0 || winningBid >= pot) {
    throw new Error("winningBid must be between 0 and the pot, exclusive");
  }
  if (winningBid % 500 !== 0) {
    throw new Error("winningBid must be a multiple of 500");
  }
  if (winningBid < runnerUpBonus) {
    throw new Error("winningBid must be at least the runnerUpBonus");
  }
  if (runnerUpBonus >= monthlyContribution) {
    throw new Error("runnerUpBonus must be less than monthlyContribution");
  }

  const others = memberIds.filter(
    (id) => id !== auction.winnerMemberId && id !== runnerUpMemberId
  );
  if (others.length <= 0) {
    throw new Error(
      "memberCount must be at least 3 for an auctioned month (winner, runner-up, and at least one other member)"
    );
  }

  const remainingPool = winningBid - runnerUpBonus;
  const share = Math.floor(remainingPool / others.length);
  const remainder = remainingPool - share * others.length;

  if (monthlyContribution - share < 0) {
    throw new Error(
      "Computed discount exceeds monthlyContribution for one or more members"
    );
  }

  const perMember: MemberDue[] = memberIds.map((memberId) => {
    if (memberId === auction.winnerMemberId) {
      return { memberId, amountOwed: monthlyContribution, role: "winner" };
    }
    if (memberId === runnerUpMemberId) {
      return {
        memberId,
        amountOwed: monthlyContribution - runnerUpBonus,
        role: "runnerUp",
      };
    }
    const otherIndex = others.indexOf(memberId);
    const extraRupeeOff = otherIndex < remainder ? 1 : 0;
    const amountOwed = monthlyContribution - share - extraRupeeOff;
    if (amountOwed < 0) {
      throw new Error(
        `Computed a negative amountOwed for member ${memberId}`
      );
    }
    return { memberId, amountOwed, role: "other" };
  });

  const payoutToWinner = pot - winningBid;
  const winnerAmountOwed = monthlyContribution;

  return {
    pot,
    payoutToWinner,
    winnerNetGain: payoutToWinner - winnerAmountOwed,
    perMember,
  };
}
