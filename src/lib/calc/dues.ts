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
 * Auctioned-month formula (confirmed against real committee data - the winner
 * is NOT exempt from that month's group discount, they just also receive the
 * auction payout on top):
 *   pool = winningBid - runnerUpBonus
 *   share = floor(pool / memberCount)   -- everyone's baseline discount, winner included
 *   runner-up additionally gets `runnerUpBonus` off, on top of their share
 *
 * Contract: `memberIds` must be passed in a STABLE order (e.g. members.sortOrder
 * ascending). When `pool` doesn't divide evenly across all members, the leftover
 * 1-rupee increments are assigned to the FIRST `remainder` entries of
 * `memberIds`, in the order given. This is deterministic and depended on by
 * tests/callers.
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

  if (memberCount < 2) {
    throw new Error(
      "memberCount must be at least 2 for an auctioned month (a winner and a runner-up)"
    );
  }
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

  const pool = winningBid - runnerUpBonus;
  const share = Math.floor(pool / memberCount);
  const remainder = pool - share * memberCount;

  const perMember: MemberDue[] = memberIds.map((memberId, index) => {
    const extraRupeeOff = index < remainder ? 1 : 0;
    const role: MemberDue["role"] =
      memberId === auction.winnerMemberId
        ? "winner"
        : memberId === runnerUpMemberId
          ? "runnerUp"
          : "other";
    const discount = share + extraRupeeOff + (role === "runnerUp" ? runnerUpBonus : 0);
    const amountOwed = monthlyContribution - discount;
    if (amountOwed < 0) {
      throw new Error(
        `Computed a negative amountOwed for member ${memberId} - winningBid too large relative to monthlyContribution/memberCount`
      );
    }
    return { memberId, amountOwed, role };
  });

  const payoutToWinner = pot - winningBid;
  const winnerAmountOwed = perMember.find(
    (d) => d.memberId === auction.winnerMemberId
  )!.amountOwed;

  return {
    pot,
    payoutToWinner,
    winnerNetGain: payoutToWinner - winnerAmountOwed,
    perMember,
  };
}
