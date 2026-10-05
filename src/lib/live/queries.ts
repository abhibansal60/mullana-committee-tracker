import { and, asc, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  auctionBids,
  auctionReactions,
  auctionSessions,
  committees,
  liveSettings,
  memberGoogleAccounts,
  memberProfiles,
  members,
  months,
} from "@/lib/db/schema";
import {
  committeeTerms,
  getEligibleAuctionMembers,
  getMembersForCommittee,
  recordAuctionResult,
  type Committee,
  type Member,
} from "@/lib/db/queries";
import { computeMonthDues } from "@/lib/calc/dues";
import { PLAYER_COOKIE, verifyPlayerSession } from "@/lib/auth/player";
import {
  COUNTDOWN_MS,
  computeMaxBid,
  isPracticeCommittee,
  defaultLiveSettings,
  isReaction,
  jumpBidOptions,
  nextBidAmount,
  standingsFromBids,
  validateBidAmount,
  validateLiveSettings,
  type LiveSettingsInput,
} from "./rules";

export type AuctionSession = typeof auctionSessions.$inferSelect;
export type MemberProfile = typeof memberProfiles.$inferSelect;

const OPEN_STATUSES = ["lobby", "live", "paused", "closed"] as const;
const ONLINE_WINDOW_MS = 12_000;
const REACTION_WINDOW_MS = 6_000;
const RESULT_LINGER_MS = 6 * 60 * 60 * 1000; // show the result screen for the rest of the day

export class LiveError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

/** True when the live-auction tables haven't been created on this database yet. */
export function isLiveSchemaMissing(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  const code = e?.code ?? e?.cause?.code;
  return code === "42P01" || /relation "(auction_|live_settings|member_profiles|member_google_accounts)/.test(e?.message ?? "");
}

// --- Settings ------------------------------------------------------------

export interface LiveSettings extends LiveSettingsInput {
  allowPhoneLogin: boolean;
}

export async function getLiveSettings(committee: Committee): Promise<LiveSettings> {
  const rows = await db
    .select()
    .from(liveSettings)
    .where(eq(liveSettings.committeeId, committee.id))
    .limit(1);
  const row = rows[0];
  if (!row) return { ...defaultLiveSettings(committeeTerms(committee)), allowPhoneLogin: false };
  return {
    openingBid: row.openingBid,
    bidIncrement: row.bidIncrement,
    roundSeconds: row.roundSeconds,
    allowPhoneLogin: row.allowPhoneLogin,
  };
}

export async function saveLiveSettings(committee: Committee, input: LiveSettings): Promise<void> {
  const error = validateLiveSettings(committeeTerms(committee), input);
  if (error) throw new LiveError(error);
  const values = {
    openingBid: input.openingBid,
    bidIncrement: input.bidIncrement,
    roundSeconds: input.roundSeconds,
    allowPhoneLogin: input.allowPhoneLogin,
    updatedAt: new Date(),
  };
  await db
    .insert(liveSettings)
    .values({ committeeId: committee.id, ...values })
    .onConflictDoUpdate({ target: liveSettings.committeeId, set: values });
}

// --- Players (member logins) -----------------------------------------------

export async function getProfilesForCommittee(committeeId: string): Promise<MemberProfile[]> {
  return db.select().from(memberProfiles).where(eq(memberProfiles.committeeId, committeeId));
}

async function ensureMemberInCommittee(committeeId: string, memberId: string): Promise<Member> {
  const rows = await db
    .select()
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.committeeId, committeeId)))
    .limit(1);
  if (!rows[0]) throw new LiveError("Member not found", 404);
  return rows[0];
}

/** Lets the holder fix a member's name (typos, nicknames). Names stay unique so the join list is unambiguous. */
export async function renameMember(committeeId: string, memberId: string, name: string): Promise<string> {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) throw new LiveError("Enter a name");
  if (trimmed.length > 100) throw new LiveError("That name is too long");
  await ensureMemberInCommittee(committeeId, memberId);
  const all = await getMembersForCommittee(committeeId);
  if (all.some((m) => m.id !== memberId && m.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new LiveError("Another member already has that name");
  }
  await db.update(members).set({ name: trimmed }).where(eq(members.id, memberId));
  return trimmed;
}

export async function setMemberPhone(
  committeeId: string,
  memberId: string,
  phone: string | null
): Promise<void> {
  await ensureMemberInCommittee(committeeId, memberId);
  if (phone) {
    const clash = await db
      .select({ memberId: memberProfiles.memberId })
      .from(memberProfiles)
      .where(and(eq(memberProfiles.committeeId, committeeId), eq(memberProfiles.phone, phone)))
      .limit(1);
    if (clash[0] && clash[0].memberId !== memberId) {
      throw new LiveError("Another member already has this number");
    }
  }
  await db
    .insert(memberProfiles)
    .values({ memberId, committeeId, phone })
    .onConflictDoUpdate({
      target: memberProfiles.memberId,
      set: { phone, updatedAt: new Date() },
    });
}

/** Logs the member out everywhere and kills their invite link. */
export async function revokeMemberAccess(committeeId: string, memberId: string): Promise<void> {
  await ensureMemberInCommittee(committeeId, memberId);
  await db
    .insert(memberProfiles)
    .values({ memberId, committeeId, sessionEpoch: 1 })
    .onConflictDoUpdate({
      target: memberProfiles.memberId,
      set: {
        sessionEpoch: sql`${memberProfiles.sessionEpoch} + 1`,
        updatedAt: new Date(),
      },
    });
  try {
    await db.delete(memberGoogleAccounts).where(eq(memberGoogleAccounts.memberId, memberId));
  } catch (err) {
    if (!isLiveSchemaMissing(err)) throw err;
  }
}

export interface LoginMatch {
  committeeId: string;
  committeeName: string;
  memberId: string;
  memberName: string;
  epoch: number;
}

/** Members nobody has claimed with a Google account yet - the names shown on the join page. */
export async function getUnclaimedMembers(committeeId: string): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: members.id, name: members.name, googleSub: memberGoogleAccounts.googleSub })
    .from(members)
    .leftJoin(memberGoogleAccounts, eq(memberGoogleAccounts.memberId, members.id))
    .where(eq(members.committeeId, committeeId))
    .orderBy(asc(members.name));
  return rows.filter((r) => !r.googleSub).map(({ id, name }) => ({ id, name }));
}

/** The Google account (email) each member joined with, for the holder's Players page. */
export async function getGoogleEmails(committeeId: string): Promise<Map<string, string | null>> {
  const rows = await db
    .select({ memberId: memberGoogleAccounts.memberId, email: memberGoogleAccounts.email })
    .from(memberGoogleAccounts)
    .where(eq(memberGoogleAccounts.committeeId, committeeId));
  return new Map(rows.map((r) => [r.memberId, r.email]));
}

/**
 * A member picks their own name on the join page: this Google account
 * becomes theirs. Names already taken can't be picked, and one Google account
 * can only be one member of a committee.
 */
export async function claimMember(
  committeeId: string,
  memberId: string,
  googleSub: string,
  email: string | null
): Promise<LoginMatch> {
  const member = await ensureMemberInCommittee(committeeId, memberId);
  const taken = new LiveError("Someone already picked that name", 409);
  let inserted: { memberId: string }[];
  try {
    inserted = await db
      .insert(memberGoogleAccounts)
      .values({ memberId, committeeId, googleSub, email })
      .onConflictDoNothing({ target: memberGoogleAccounts.memberId })
      .returning({ memberId: memberGoogleAccounts.memberId });
  } catch (err) {
    // The (committee, google account) unique index: this account is already someone else here.
    if ((err as { code?: string; cause?: { code?: string } })?.code === "23505" || (err as { cause?: { code?: string } })?.cause?.code === "23505") {
      throw new LiveError("This Google account has already joined as someone else", 409);
    }
    throw err;
  }
  if (inserted.length === 0) throw taken;
  const committee = await db.select({ name: committees.name }).from(committees).where(eq(committees.id, committeeId)).limit(1);
  const profile = await db
    .select({ epoch: memberProfiles.sessionEpoch })
    .from(memberProfiles)
    .where(eq(memberProfiles.memberId, memberId))
    .limit(1);
  return {
    committeeId,
    committeeName: committee[0]?.name ?? "",
    memberId,
    memberName: member.name,
    epoch: profile[0]?.epoch ?? 0,
  };
}

/** Every committee membership linked to this Google account. */
export async function findLoginsByGoogleSub(googleSub: string): Promise<LoginMatch[]> {
  return db
    .select({
      committeeId: memberGoogleAccounts.committeeId,
      committeeName: committees.name,
      memberId: memberGoogleAccounts.memberId,
      memberName: members.name,
      epoch: sql<number>`coalesce(${memberProfiles.sessionEpoch}, 0)`,
    })
    .from(memberGoogleAccounts)
    .innerJoin(members, eq(members.id, memberGoogleAccounts.memberId))
    .innerJoin(committees, eq(committees.id, memberGoogleAccounts.committeeId))
    .leftJoin(memberProfiles, eq(memberProfiles.memberId, memberGoogleAccounts.memberId))
    .where(eq(memberGoogleAccounts.googleSub, googleSub));
}

/** Every committee membership registered under this phone number. */
export async function findLoginsByPhone(phone: string): Promise<LoginMatch[]> {
  const rows = await db
    .select({
      committeeId: memberProfiles.committeeId,
      committeeName: committees.name,
      memberId: memberProfiles.memberId,
      memberName: members.name,
      epoch: memberProfiles.sessionEpoch,
      allowPhoneLogin: liveSettings.allowPhoneLogin,
    })
    .from(memberProfiles)
    .innerJoin(members, eq(members.id, memberProfiles.memberId))
    .innerJoin(committees, eq(committees.id, memberProfiles.committeeId))
    .leftJoin(liveSettings, eq(liveSettings.committeeId, memberProfiles.committeeId))
    .where(eq(memberProfiles.phone, phone));
  return rows
    .filter((r) => r.allowPhoneLogin === true)
    .map((r) => ({
      committeeId: r.committeeId,
      committeeName: r.committeeName,
      memberId: r.memberId,
      memberName: r.memberName,
      epoch: r.epoch,
    }));
}

/** Other committee seats under the same phone number or Google account as this member. */
export async function getOtherMemberships(memberId: string): Promise<LoginMatch[]> {
  const mine = await db
    .select({ phone: memberProfiles.phone, googleSub: memberGoogleAccounts.googleSub })
    .from(members)
    .leftJoin(memberProfiles, eq(memberProfiles.memberId, members.id))
    .leftJoin(memberGoogleAccounts, eq(memberGoogleAccounts.memberId, members.id))
    .where(eq(members.id, memberId))
    .limit(1);
  const { phone, googleSub } = mine[0] ?? {};
  const [byPhone, byGoogle] = await Promise.all([
    phone ? findLoginsByPhone(phone) : [],
    googleSub ? findLoginsByGoogleSub(googleSub) : [],
  ]);
  const others = new Map<string, LoginMatch>();
  for (const m of [...byPhone, ...byGoogle]) if (m.memberId !== memberId) others.set(m.memberId, m);
  return [...others.values()];
}

export async function markLoggedIn(memberId: string): Promise<void> {
  const member = await db.select({ committeeId: members.committeeId }).from(members).where(eq(members.id, memberId)).limit(1);
  if (!member[0]) return;
  // Members who join with Google may not have a profile row yet.
  await db
    .insert(memberProfiles)
    .values({ memberId, committeeId: member[0].committeeId, lastLoginAt: new Date() })
    .onConflictDoUpdate({ target: memberProfiles.memberId, set: { lastLoginAt: new Date() } });
}

/** True when at least one committee lets members log in with a phone number. */
export async function anyPhoneLoginEnabled(): Promise<boolean> {
  try {
    const rows = await db.select({ id: liveSettings.committeeId }).from(liveSettings).where(eq(liveSettings.allowPhoneLogin, true)).limit(1);
    return rows.length > 0;
  } catch (err) {
    if (isLiveSchemaMissing(err)) return false;
    throw err;
  }
}

export interface Player {
  committee: Committee;
  member: Member;
}

/** The logged-in member for this request, or null. Read-only (safe in Server Components). */
export async function getCurrentPlayer(): Promise<Player | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PLAYER_COOKIE)?.value;
  if (!raw) return null;
  const session = await verifyPlayerSession(raw);
  if (!session) return null;
  try {
    const rows = await db
      .select({ committee: committees, member: members, epoch: memberProfiles.sessionEpoch })
      .from(members)
      .innerJoin(committees, eq(committees.id, members.committeeId))
      .leftJoin(memberProfiles, eq(memberProfiles.memberId, members.id))
      .where(and(eq(members.id, session.memberId), eq(members.committeeId, session.committeeId)))
      .limit(1);
    const row = rows[0];
    if (!row || (row.epoch ?? 0) !== session.epoch) return null;
    return { committee: row.committee, member: row.member };
  } catch (err) {
    if (isLiveSchemaMissing(err)) return null;
    throw err;
  }
}

async function touchPresence(committeeId: string, memberId: string): Promise<void> {
  await db
    .insert(memberProfiles)
    .values({ memberId, committeeId, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: memberProfiles.memberId,
      set: { lastSeenAt: new Date() },
      setWhere: sql`${memberProfiles.lastSeenAt} is null or ${memberProfiles.lastSeenAt} < now() - interval '3 seconds'`,
    });
}

// --- Sessions ------------------------------------------------------------

export async function getOpenSession(committeeId: string): Promise<AuctionSession | null> {
  const rows = await db
    .select()
    .from(auctionSessions)
    .where(
      and(
        eq(auctionSessions.committeeId, committeeId),
        inArray(auctionSessions.status, [...OPEN_STATUSES])
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/** The session people should be looking at right now: an open one, or today's result. */
export async function getDisplaySession(committeeId: string): Promise<AuctionSession | null> {
  const open = await getOpenSession(committeeId);
  if (open) return settleClock(open);
  const rows = await db
    .select()
    .from(auctionSessions)
    .where(
      and(
        eq(auctionSessions.committeeId, committeeId),
        eq(auctionSessions.status, "finalized"),
        gt(auctionSessions.updatedAt, new Date(Date.now() - RESULT_LINGER_MS))
      )
    )
    .orderBy(desc(auctionSessions.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * There's no background worker, so the hammer falls lazily: whoever reads
 * the session first after the clock runs out closes it.
 */
async function settleClock(s: AuctionSession): Promise<AuctionSession> {
  if (s.status !== "live" || !s.roundEndsAt || s.roundEndsAt.getTime() > Date.now()) return s;
  const rows = await db
    .update(auctionSessions)
    .set({
      status: "closed",
      closedAt: sql`now()`,
      version: sql`${auctionSessions.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(auctionSessions.id, s.id),
        eq(auctionSessions.status, "live"),
        sql`${auctionSessions.roundEndsAt} <= now()`
      )
    )
    .returning();
  if (rows[0]) return rows[0];
  const fresh = await db.select().from(auctionSessions).where(eq(auctionSessions.id, s.id)).limit(1);
  return fresh[0] ?? s;
}

async function bumpSession(
  id: string,
  set: PgUpdateSetSource<typeof auctionSessions>,
  where = sql`true`
): Promise<AuctionSession | null> {
  const rows = await db
    .update(auctionSessions)
    .set({ ...set, version: sql`${auctionSessions.version} + 1`, updatedAt: new Date() })
    .where(and(eq(auctionSessions.id, id), where))
    .returning();
  return rows[0] ?? null;
}

/** Months the holder can open a room for: not the reserved month, auction not yet recorded. */
export async function getAuctionableMonths(committee: Committee) {
  const rows = await db
    .select({ id: months.id, monthNumber: months.monthNumber, auctionRecordedAt: months.auctionRecordedAt })
    .from(months)
    .where(eq(months.committeeId, committee.id))
    .orderBy(asc(months.monthNumber));
  return rows.filter(
    (m) => !m.auctionRecordedAt && m.monthNumber !== committee.reservedMonthNumber
  );
}

export async function openLobby(committee: Committee, monthId: string): Promise<AuctionSession> {
  const existing = await getOpenSession(committee.id);
  if (existing) throw new LiveError("A room is already open - close it first");

  const month = (await getAuctionableMonths(committee)).find((m) => m.id === monthId);
  if (!month) throw new LiveError("That month can't be auctioned (reserved or already recorded)");

  const eligible = await getEligibleAuctionMembers(committee.id, monthId);
  if (eligible.length < 2) throw new LiveError("Need at least 2 eligible members to hold an auction");

  const settings = await getLiveSettings(committee);
  const error = validateLiveSettings(committeeTerms(committee), settings);
  if (error) throw new LiveError(`Fix the live settings first: ${error}`);

  try {
    const [row] = await db
      .insert(auctionSessions)
      .values({
        committeeId: committee.id,
        monthId,
        status: "lobby",
        openingBid: settings.openingBid,
        bidIncrement: settings.bidIncrement,
        roundSeconds: settings.roundSeconds,
        hostLastSeenAt: new Date(),
      })
      .returning();
    return row;
  } catch (err) {
    // The partial unique index lost a race with another "open room" tap.
    if ((err as { code?: string })?.code === "23505") {
      throw new LiveError("A room is already open - close it first");
    }
    throw err;
  }
}

export type HostAction =
  | { action: "start" }
  | { action: "pause" }
  | { action: "resume" }
  | { action: "extend" }
  | { action: "hammer" }
  | { action: "undo" }
  | { action: "reopen" }
  | { action: "cancel" }
  | { action: "finalize"; runnerUpMemberId?: string };

export async function runHostAction(committee: Committee, input: HostAction): Promise<void> {
  const open = await getOpenSession(committee.id);
  if (!open) throw new LiveError("No room is open", 404);
  const s = await settleClock(open);
  const status = s.status;

  switch (input.action) {
    case "start": {
      if (status !== "lobby") throw new LiveError("Bidding has already started");
      await bumpSession(
        s.id,
        { status: "live", startsAt: new Date(Date.now() + COUNTDOWN_MS), roundEndsAt: null },
        sql`${auctionSessions.status} = 'lobby'`
      );
      return;
    }
    case "pause": {
      if (status !== "live") throw new LiveError("Only live bidding can be paused");
      const remaining = s.roundEndsAt ? Math.max(0, s.roundEndsAt.getTime() - Date.now()) : null;
      await bumpSession(
        s.id,
        { status: "paused", pausedRemainingMs: remaining, roundEndsAt: null },
        sql`${auctionSessions.status} = 'live'`
      );
      return;
    }
    case "resume": {
      if (status !== "paused") throw new LiveError("Bidding isn't paused");
      await bumpSession(
        s.id,
        {
          status: "live",
          roundEndsAt:
            s.pausedRemainingMs != null
              ? new Date(Date.now() + Math.max(s.pausedRemainingMs, 5000))
              : null,
          pausedRemainingMs: null,
        },
        sql`${auctionSessions.status} = 'paused'`
      );
      return;
    }
    case "extend": {
      if (status === "live" && s.roundEndsAt) {
        await bumpSession(
          s.id,
          { roundEndsAt: sql`${auctionSessions.roundEndsAt} + interval '10 seconds'` },
          sql`${auctionSessions.status} = 'live'`
        );
        return;
      }
      if (status === "paused" && s.pausedRemainingMs != null) {
        await bumpSession(s.id, { pausedRemainingMs: s.pausedRemainingMs + 10_000 });
        return;
      }
      throw new LiveError("The clock isn't running");
    }
    case "hammer": {
      if (status !== "live" && status !== "paused") throw new LiveError("Nothing to sell right now");
      if (s.bidCount === 0 || !s.leaderMemberId) throw new LiveError("No bids yet");
      await bumpSession(s.id, {
        status: "closed",
        closedAt: new Date(),
        roundEndsAt: new Date(),
        pausedRemainingMs: null,
      });
      return;
    }
    case "reopen": {
      if (status !== "closed") throw new LiveError("Only a sold auction can be reopened");
      await bumpSession(
        s.id,
        {
          status: "live",
          closedAt: null,
          roundEndsAt: new Date(Date.now() + s.roundSeconds * 1000),
        },
        sql`${auctionSessions.status} = 'closed'`
      );
      return;
    }
    case "undo": {
      if (status === "lobby") throw new LiveError("No bids yet");
      const last = await db
        .select()
        .from(auctionBids)
        .where(eq(auctionBids.sessionId, s.id))
        .orderBy(desc(auctionBids.createdAt))
        .limit(1);
      if (!last[0]) throw new LiveError("No bids to undo");
      await db.delete(auctionBids).where(eq(auctionBids.id, last[0].id));
      const remaining = await db
        .select({ memberId: auctionBids.memberId, amount: auctionBids.amount })
        .from(auctionBids)
        .where(eq(auctionBids.sessionId, s.id))
        .orderBy(asc(auctionBids.createdAt));
      const standings = standingsFromBids(remaining);
      await bumpSession(s.id, {
        status: status === "closed" ? "live" : status,
        closedAt: null,
        currentBid: standings.currentBid,
        leaderMemberId: standings.leaderId,
        runnerUpMemberId: standings.runnerUpId,
        bidCount: remaining.length,
        roundEndsAt:
          status === "paused"
            ? null
            : remaining.length > 0
              ? new Date(Date.now() + s.roundSeconds * 1000)
              : null,
        pausedRemainingMs: status === "paused" && remaining.length > 0 ? s.roundSeconds * 1000 : null,
      });
      return;
    }
    case "cancel": {
      await bumpSession(s.id, { status: "cancelled", roundEndsAt: null });
      return;
    }
    case "finalize": {
      if (status !== "closed") throw new LiveError("Close the bidding first");
      if (!s.leaderMemberId || s.currentBid == null) throw new LiveError("No winning bid");
      const runnerUpId = s.runnerUpMemberId ?? input.runnerUpMemberId;
      if (!runnerUpId) throw new LiveError("Pick the runner-up - only one person bid");
      if (runnerUpId === s.leaderMemberId) throw new LiveError("Runner-up can't be the winner");

      // Someone may have recorded this month by hand while the room was open.
      if (!(await getAuctionableMonths(committee)).some((m) => m.id === s.monthId)) {
        throw new LiveError("This month's result has already been recorded");
      }
      const eligible = await getEligibleAuctionMembers(committee.id, s.monthId);
      const eligibleIds = new Set(eligible.map((m) => m.id));
      if (!eligibleIds.has(s.leaderMemberId) || !eligibleIds.has(runnerUpId)) {
        throw new LiveError("Winner or runner-up is no longer eligible for this month");
      }
      const allMembers = await getMembersForCommittee(committee.id);
      try {
        computeMonthDues(
          committeeTerms(committee),
          allMembers.map((m) => m.id),
          {
            isReserved: false,
            winnerMemberId: s.leaderMemberId,
            winningBid: s.currentBid,
            runnerUpMemberId: runnerUpId,
          }
        );
      } catch (err) {
        throw new LiveError(err instanceof Error ? err.message : "Invalid result");
      }
      const claimed = await bumpSession(
        s.id,
        { status: "finalized", runnerUpMemberId: runnerUpId },
        sql`${auctionSessions.status} = 'closed'`
      );
      if (!claimed) throw new LiveError("The room changed - try again", 409);
      try {
        const recorded = await recordAuctionResult(s.monthId, {
          isReserved: false,
          winnerMemberId: s.leaderMemberId,
          winningBid: s.currentBid,
          runnerUpMemberId: runnerUpId,
        });
        if (!recorded) throw new LiveError("This month's result was already recorded on the month page", 409);
      } catch (err) {
        // Don't leave the room "finalized" with nothing recorded: put it back
        // so the holder can confirm again.
        await bumpSession(s.id, { status: "closed" }, sql`${auctionSessions.status} = 'finalized'`);
        throw err;
      }
      return;
    }
  }
}

// --- Bidding & reactions ---------------------------------------------------

export async function placeBid(
  committee: Committee,
  memberId: string,
  expectedBid: number | null,
  amount: number
): Promise<void> {
  const open = await getOpenSession(committee.id);
  if (!open) throw new LiveError("No auction is running", 404);
  const s = await settleClock(open);
  if (s.status === "lobby") throw new LiveError("Bidding hasn't started yet");
  if (s.status === "paused") throw new LiveError("Bidding is paused");
  if (s.status !== "live") throw new LiveError("Bidding is closed");
  if (s.startsAt && s.startsAt.getTime() > Date.now()) throw new LiveError("Wait for the countdown!");
  if (s.leaderMemberId === memberId) throw new LiveError("You're already the highest bidder");

  const eligible = await getEligibleAuctionMembers(committee.id, s.monthId);
  if (!eligible.some((m) => m.id === memberId)) {
    throw new LiveError("You're watching this one - you can't bid this month", 403);
  }

  if (s.currentBid !== expectedBid) {
    throw new LiveError("Someone just bid - check the new amount", 409);
  }
  const error = validateBidAmount(s, amount, computeMaxBid(committeeTerms(committee)));
  if (error) throw new LiveError(error);

  // One atomic statement: the session only moves if nobody else got there
  // first (current_bid unchanged, clock still running), and the bid is only
  // logged if the session moved. SET expressions see the pre-update row, so
  // the old leader becomes the runner-up.
  const result = await db.execute(sql`
    with moved as (
      update auction_sessions set
        current_bid = ${amount},
        runner_up_member_id = case
          when leader_member_id is not null and leader_member_id <> ${memberId}
          then leader_member_id else runner_up_member_id end,
        leader_member_id = ${memberId},
        bid_count = bid_count + 1,
        version = version + 1,
        round_ends_at = now() + make_interval(secs => round_seconds),
        updated_at = now()
      where id = ${s.id}
        and status = 'live'
        and (starts_at is null or starts_at <= now())
        and (round_ends_at is null or round_ends_at > now())
        and current_bid is not distinct from ${expectedBid}::integer
        and (leader_member_id is null or leader_member_id <> ${memberId})
      returning id
    )
    insert into auction_bids (id, session_id, member_id, amount)
    select gen_random_uuid(), id, ${memberId}, ${amount} from moved
    returning id
  `);
  const rows = (result as unknown as { rows: unknown[] }).rows;
  if (!rows || rows.length === 0) {
    throw new LiveError("Too slow - someone got there first!", 409);
  }
}

export async function addReaction(
  committee: Committee,
  memberId: string | null,
  emoji: string
): Promise<void> {
  if (!isReaction(emoji)) throw new LiveError("Unknown reaction");
  const s = await getDisplaySession(committee.id);
  if (!s || s.status === "cancelled") throw new LiveError("No room is open", 404);
  const recent = await db
    .select({ id: auctionReactions.id })
    .from(auctionReactions)
    .where(
      and(
        eq(auctionReactions.sessionId, s.id),
        memberId ? eq(auctionReactions.memberId, memberId) : sql`${auctionReactions.memberId} is null`,
        gt(auctionReactions.createdAt, new Date(Date.now() - 600))
      )
    )
    .limit(1);
  if (recent[0]) return; // gentle rate limit - drop spam silently
  await db.insert(auctionReactions).values({ sessionId: s.id, memberId, emoji });
}

// --- State for the room ----------------------------------------------------

export interface LivePlayer {
  id: string;
  name: string;
  isHolder: boolean;
  eligible: boolean; // can bid this month
  online: boolean;
  wonMonth: number | null;
  bot: boolean; // practice room only: seat played by a bot
}

export interface LiveBid {
  id: string;
  memberId: string;
  amount: number;
  at: number;
}

export interface LiveReaction {
  id: string;
  memberId: string | null;
  emoji: string;
  at: number;
}

export interface LiveState {
  serverNow: number;
  committee: {
    name: string;
    memberCount: number;
    monthlyContribution: number;
    pot: number;
    runnerUpBonus: number;
    durationMonths: number;
    practice: boolean;
  };
  hostOnline: boolean;
  hostName: string;
  players: LivePlayer[];
  session: null | {
    id: string;
    status: AuctionSession["status"];
    monthNumber: number;
    openingBid: number;
    bidIncrement: number;
    roundSeconds: number;
    currentBid: number | null;
    leaderId: string | null;
    runnerUpId: string | null;
    bidCount: number;
    version: number;
    startsAt: number | null;
    roundEndsAt: number | null;
    pausedRemainingMs: number | null;
    nextBid: number;
    jumpOptions: number[];
    maxBid: number;
    takesHome: number | null;
  };
  bids: LiveBid[];
  reactions: LiveReaction[];
  me: null | {
    memberId: string;
    name: string;
    eligible: boolean;
    isLeader: boolean;
    canBid: boolean;
    dueThisMonth: number | null; // known once the result is recorded
  };
}

export type Viewer =
  | { kind: "player"; memberId: string; peek?: boolean } // peek = glancing from the home screen, not "in the room"
  | { kind: "host" };

export async function getLiveState(committee: Committee, viewer: Viewer): Promise<LiveState> {
  const session = await getDisplaySession(committee.id);

  const [allMembers, profiles, monthRows] = await Promise.all([
    getMembersForCommittee(committee.id),
    getProfilesForCommittee(committee.id),
    db
      .select({
        id: months.id,
        monthNumber: months.monthNumber,
        winnerMemberId: months.winnerMemberId,
      })
      .from(months)
      .where(and(eq(months.committeeId, committee.id), isNotNull(months.auctionRecordedAt))),
  ]);

  const holder = allMembers.find((m) => m.isHolder);
  const wonMonthById = new Map<string, number>();
  for (const m of monthRows) {
    const winnerId = m.monthNumber === committee.reservedMonthNumber ? holder?.id : m.winnerMemberId;
    if (winnerId && m.id !== session?.monthId) wonMonthById.set(winnerId, m.monthNumber);
  }

  const now = Date.now();
  const seenById = new Map(profiles.map((p) => [p.memberId, p.lastSeenAt?.getTime() ?? 0]));
  const practice = isPracticeCommittee(committee);
  const loggedInIds = new Set(profiles.filter((p) => p.lastLoginAt).map((p) => p.memberId));
  if (viewer.kind === "player" && !viewer.peek) seenById.set(viewer.memberId, now);

  let eligibleIds = new Set<string>();
  let bids: LiveBid[] = [];
  let reactions: LiveReaction[] = [];
  let monthNumber = 0;

  if (session) {
    const [eligible, bidRows, reactionRows, monthRow] = await Promise.all([
      getEligibleAuctionMembers(committee.id, session.monthId),
      db
        .select()
        .from(auctionBids)
        .where(eq(auctionBids.sessionId, session.id))
        .orderBy(desc(auctionBids.createdAt))
        .limit(25),
      db
        .select()
        .from(auctionReactions)
        .where(
          and(
            eq(auctionReactions.sessionId, session.id),
            gt(auctionReactions.createdAt, new Date(now - REACTION_WINDOW_MS))
          )
        )
        .orderBy(asc(auctionReactions.createdAt))
        .limit(60),
      db.select({ monthNumber: months.monthNumber }).from(months).where(eq(months.id, session.monthId)).limit(1),
    ]);
    eligibleIds = new Set(eligible.map((m) => m.id));
    bids = bidRows.map((b) => ({ id: b.id, memberId: b.memberId, amount: b.amount, at: b.createdAt.getTime() }));
    reactions = reactionRows.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      emoji: r.emoji,
      at: r.createdAt.getTime(),
    }));
    monthNumber = monthRow[0]?.monthNumber ?? 0;
  }

  // Presence side effects - fire and forget-ish, but awaited so serverless
  // doesn't drop them.
  if (viewer.kind === "player") {
    if (!viewer.peek) await touchPresence(committee.id, viewer.memberId);
  } else if (session && ["lobby", "live", "paused", "closed"].includes(session.status)) {
    await db
      .update(auctionSessions)
      .set({ hostLastSeenAt: new Date() })
      .where(
        and(
          eq(auctionSessions.id, session.id),
          sql`(${auctionSessions.hostLastSeenAt} is null or ${auctionSessions.hostLastSeenAt} < now() - interval '3 seconds')`
        )
      );
  }

  const terms = committeeTerms(committee);
  const pot = terms.memberCount * terms.monthlyContribution;
  const maxBid = computeMaxBid(terms);

  const players: LivePlayer[] = allMembers.map((m) => ({
    id: m.id,
    name: m.name,
    isHolder: m.isHolder,
    eligible: eligibleIds.has(m.id),
    online: now - (seenById.get(m.id) ?? 0) < ONLINE_WINDOW_MS,
    wonMonth: wonMonthById.get(m.id) ?? null,
    bot: practice && !m.isHolder && !loggedInIds.has(m.id),
  }));

  let me: LiveState["me"] = null;
  if (viewer.kind === "player") {
    const member = allMembers.find((m) => m.id === viewer.memberId);
    if (member) {
      const eligible = eligibleIds.has(member.id);
      const isLeader = session?.leaderMemberId === member.id;
      let dueThisMonth: number | null = null;
      if (session?.status === "finalized" && session.leaderMemberId && session.currentBid && session.runnerUpMemberId) {
        try {
          const dues = computeMonthDues(terms, allMembers.map((m) => m.id), {
            isReserved: false,
            winnerMemberId: session.leaderMemberId,
            winningBid: session.currentBid,
            runnerUpMemberId: session.runnerUpMemberId,
          });
          dueThisMonth = dues.perMember.find((d) => d.memberId === member.id)?.amountOwed ?? null;
        } catch {
          dueThisMonth = null;
        }
      }
      me = {
        memberId: member.id,
        name: member.name,
        eligible,
        isLeader,
        canBid:
          !!session &&
          session.status === "live" &&
          eligible &&
          !isLeader &&
          (!session.startsAt || session.startsAt.getTime() <= now),
        dueThisMonth,
      };
    }
  }

  return {
    serverNow: now,
    committee: {
      name: committee.name,
      memberCount: committee.memberCount,
      monthlyContribution: committee.monthlyContribution,
      pot,
      runnerUpBonus: committee.runnerUpBonus,
      durationMonths: committee.durationMonths,
      practice,
    },
    hostOnline:
      viewer.kind === "host" ||
      (!!session?.hostLastSeenAt && now - session.hostLastSeenAt.getTime() < ONLINE_WINDOW_MS),
    hostName: holder?.name ?? "Holder",
    players,
    session: session
      ? {
          id: session.id,
          status: session.status,
          monthNumber,
          openingBid: session.openingBid,
          bidIncrement: session.bidIncrement,
          roundSeconds: session.roundSeconds,
          currentBid: session.currentBid,
          leaderId: session.leaderMemberId,
          runnerUpId: session.runnerUpMemberId,
          bidCount: session.bidCount,
          version: session.version,
          startsAt: session.startsAt?.getTime() ?? null,
          roundEndsAt: session.roundEndsAt?.getTime() ?? null,
          pausedRemainingMs: session.pausedRemainingMs,
          nextBid: nextBidAmount(session),
          jumpOptions: jumpBidOptions(session, maxBid),
          maxBid,
          takesHome: session.currentBid != null ? pot - session.currentBid : null,
        }
      : null,
    bids,
    reactions,
    me,
  };
}
