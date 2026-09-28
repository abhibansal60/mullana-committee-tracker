import { computeMonthDues, type CommitteeTerms } from "@/lib/calc/dues";

/**
 * Pure rules for the live auction room. No DB access - everything here is
 * unit-tested in rules.test.ts.
 *
 * Vocabulary (same as the rest of the app): a "bid" is the discount the
 * bidder is willing to give up from the pot. Bids go UP; the highest bid
 * wins, takes home (pot - bid), and the previous leader becomes the
 * runner-up who gets the runner-up bonus.
 */

export const BID_STEP = 500; // computeMonthDues requires multiples of 500

export const ROUND_SECONDS_MIN = 10;
export const ROUND_SECONDS_MAX = 120;
export const COUNTDOWN_MS = 3500; // the 3-2-1 before bidding opens

export const REACTIONS = ["🔥", "👏", "😂", "😱", "💸", "🙏"] as const;
export type Reaction = (typeof REACTIONS)[number];

export function isReaction(value: string): value is Reaction {
  return (REACTIONS as readonly string[]).includes(value);
}

/**
 * Accepts the ways people actually type an Indian mobile number
 * ("98765 43210", "+91-98765-43210", "098765 43210") and returns the bare
 * 10 digits, or null if it isn't one.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}

export function formatPhone(phone: string): string {
  return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
}

/** Smallest valid opening bid for these terms. */
export function minOpeningBid(terms: CommitteeTerms): number {
  return Math.max(BID_STEP, Math.ceil(terms.runnerUpBonus / BID_STEP) * BID_STEP);
}

/**
 * Largest bid computeMonthDues will accept for these terms: below the pot,
 * and small enough that nobody (the runner-up in particular) ends up owing
 * a negative amount. Found by probing the real formula rather than
 * re-deriving it, so the two can never disagree.
 */
export function computeMaxBid(terms: CommitteeTerms): number {
  const ids = Array.from({ length: terms.memberCount }, (_, i) => `m${i}`);
  if (ids.length < 2) return 0;
  const pot = terms.memberCount * terms.monthlyContribution;
  for (let bid = Math.floor((pot - 1) / BID_STEP) * BID_STEP; bid >= BID_STEP; bid -= BID_STEP) {
    try {
      // The runner-up is the member whose due drops the most; putting them
      // last (no remainder rupee) is the worst case.
      computeMonthDues(terms, ids, {
        isReserved: false,
        winnerMemberId: ids[0],
        winningBid: bid,
        runnerUpMemberId: ids[ids.length - 1],
      });
      return bid;
    } catch {
      // too big - keep probing down
    }
  }
  return 0;
}

export interface LiveSettingsInput {
  openingBid: number;
  bidIncrement: number;
  roundSeconds: number;
}

/** Returns an error message, or null when the settings are usable. */
export function validateLiveSettings(
  terms: CommitteeTerms,
  s: LiveSettingsInput
): string | null {
  if (!Number.isInteger(s.bidIncrement) || s.bidIncrement <= 0 || s.bidIncrement % BID_STEP !== 0) {
    return `Bid step must be a multiple of ₹${BID_STEP}`;
  }
  if (!Number.isInteger(s.openingBid) || s.openingBid % BID_STEP !== 0) {
    return `Opening bid must be a multiple of ₹${BID_STEP}`;
  }
  const min = minOpeningBid(terms);
  if (s.openingBid < min) {
    return `Opening bid must be at least ₹${min.toLocaleString("en-IN")} (the runner-up bonus)`;
  }
  const max = computeMaxBid(terms);
  if (s.openingBid > max) {
    return `Opening bid can be at most ₹${max.toLocaleString("en-IN")}`;
  }
  if (
    !Number.isInteger(s.roundSeconds) ||
    s.roundSeconds < ROUND_SECONDS_MIN ||
    s.roundSeconds > ROUND_SECONDS_MAX
  ) {
    return `Timer must be between ${ROUND_SECONDS_MIN} and ${ROUND_SECONDS_MAX} seconds`;
  }
  return null;
}

export function defaultLiveSettings(terms: CommitteeTerms): LiveSettingsInput {
  return {
    openingBid: Math.min(
      computeMaxBid(terms),
      Math.max(minOpeningBid(terms), roundUpToStep(terms.monthlyContribution))
    ),
    bidIncrement: BID_STEP,
    roundSeconds: 30,
  };
}

function roundUpToStep(n: number): number {
  return Math.ceil(n / BID_STEP) * BID_STEP;
}

export interface BidState {
  currentBid: number | null;
  openingBid: number;
  bidIncrement: number;
}

/** What the big "BID" button offers next. */
export function nextBidAmount(s: BidState): number {
  return s.currentBid == null ? s.openingBid : s.currentBid + s.bidIncrement;
}

/** Returns an error message, or null when `amount` is a valid next bid. */
export function validateBidAmount(s: BidState, amount: number, maxBid: number): string | null {
  if (!Number.isInteger(amount) || amount % BID_STEP !== 0) {
    return `Bids go in steps of ₹${BID_STEP}`;
  }
  const next = nextBidAmount(s);
  if (amount < next) {
    return `The next bid has to be at least ₹${next.toLocaleString("en-IN")}`;
  }
  if (amount > maxBid) {
    return `Bids can't go above ₹${maxBid.toLocaleString("en-IN")}`;
  }
  return null;
}

/** Quick-jump options shown next to the main bid button. */
export function jumpBidOptions(s: BidState, maxBid: number): number[] {
  const next = nextBidAmount(s);
  const options = [next, next + s.bidIncrement, next + s.bidIncrement * 3];
  return [...new Set(options.filter((a) => a <= maxBid))];
}

export type ClockPhase = "open" | "going-once" | "going-twice" | "sold";

/** Auctioneer call for how much of the round is left. */
export function clockPhase(remainingMs: number, roundSeconds: number): ClockPhase {
  if (remainingMs <= 0) return "sold";
  const third = (roundSeconds * 1000) / 3;
  if (remainingMs <= third) return "going-twice";
  if (remainingMs <= third * 2 && roundSeconds >= 15) return "going-once";
  return "open";
}

/**
 * Leader and runner-up implied by a bid history (oldest first). The
 * runner-up is the most recent bidder other than the leader - the person
 * the winner had to outbid last.
 */
export function standingsFromBids(
  bids: { memberId: string; amount: number }[]
): { leaderId: string | null; runnerUpId: string | null; currentBid: number | null } {
  if (bids.length === 0) return { leaderId: null, runnerUpId: null, currentBid: null };
  const last = bids[bids.length - 1];
  let runnerUpId: string | null = null;
  for (let i = bids.length - 2; i >= 0; i--) {
    if (bids[i].memberId !== last.memberId) {
      runnerUpId = bids[i].memberId;
      break;
    }
  }
  return { leaderId: last.memberId, runnerUpId, currentBid: last.amount };
}
