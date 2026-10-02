import { createHmac } from "node:crypto";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  committees,
  liveSettings,
  memberGoogleAccounts,
  memberProfiles,
  members,
  months,
} from "@/lib/db/schema";
import {
  committeeTerms,
  getCommitteeByAdminTokenHash,
  getEligibleAuctionMembers,
  getMembersForCommittee,
  getMonthsForCommittee,
  type Committee,
} from "@/lib/db/queries";
import { generateToken, sha256Hex } from "@/lib/auth/tokens";
import { PRACTICE_PREFIX, computeMaxBid, isPracticeCommittee, jumpBidOptions } from "./rules";
import { isLiveSchemaMissing, LiveError, placeBid, type AuctionSession } from "./queries";

/**
 * Practice room: a throwaway copy of a real committee that the holder can
 * rehearse committee day in, with bots filling the empty seats.
 *
 * No extra tables or columns: the practice committee's admin token is
 * derived from the real committee's id with the server secret, so the real
 * admin can always find (and reset) its practice copy, and nothing in the
 * practice copy can reach the real one.
 */
export { PRACTICE_PREFIX, isPracticeCommittee };

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

/** The practice committee's admin token for a given real committee. */
export function practiceAdminToken(realCommitteeId: string): string {
  return createHmac("sha256", secret()).update(`practice:${realCommitteeId}`).digest("base64url").slice(0, 32);
}

export async function getPracticeCommittee(real: Committee): Promise<Committee | null> {
  return getCommitteeByAdminTokenHash(sha256Hex(practiceAdminToken(real.id)));
}

/**
 * Given a practice committee and a claimed parent admin token, returns the
 * parent only if it really owns this practice copy.
 */
export async function verifyPracticeParent(
  practice: Committee,
  parentAdminToken: string | undefined
): Promise<Committee | null> {
  if (!parentAdminToken) return null;
  const parent = await getCommitteeByAdminTokenHash(sha256Hex(parentAdminToken));
  if (!parent) return null;
  const expected = sha256Hex(practiceAdminToken(parent.id));
  return expected === practice.adminTokenHash ? parent : null;
}

export async function deletePracticeCommittee(real: Committee): Promise<void> {
  const practice = await getPracticeCommittee(real);
  if (practice) await db.delete(committees).where(eq(committees.id, practice.id));
}

/**
 * Creates the practice copy (replacing any existing one): same members,
 * phone numbers, linked Google accounts, terms, room settings and recorded
 * auction results - so the lobby shows exactly who can bid next - but no
 * payments and no logins.
 */
export async function createPracticeCommittee(real: Committee): Promise<Committee> {
  if (isPracticeCommittee(real)) throw new LiveError("This is already a practice committee");
  await deletePracticeCommittee(real);

  const [realMembers, realMonths, realProfiles, realSettings] = await Promise.all([
    getMembersForCommittee(real.id),
    getMonthsForCommittee(real.id),
    db.select().from(memberProfiles).where(eq(memberProfiles.committeeId, real.id)),
    db.select().from(liveSettings).where(eq(liveSettings.committeeId, real.id)).limit(1),
  ]);

  const [practice] = await db
    .insert(committees)
    .values({
      name: `${PRACTICE_PREFIX}${real.name}`.slice(0, 100),
      memberCount: real.memberCount,
      monthlyContribution: real.monthlyContribution,
      durationMonths: real.durationMonths,
      reservedMonthNumber: real.reservedMonthNumber,
      runnerUpBonus: real.runnerUpBonus,
      showProfitLoss: real.showProfitLoss,
      adminTokenHash: sha256Hex(practiceAdminToken(real.id)),
      memberTokenHash: sha256Hex(generateToken()),
      adminPinHash: real.adminPinHash,
    })
    .returning();

  try {
    const idMap = new Map<string, string>();
    for (const m of realMembers) idMap.set(m.id, crypto.randomUUID());

    await db.insert(members).values(
      realMembers.map((m) => ({
        id: idMap.get(m.id)!,
        committeeId: practice.id,
        name: m.name,
        isHolder: m.isHolder,
        sortOrder: m.sortOrder,
      }))
    );

    await db.insert(months).values(
      realMonths.map((m) => ({
        committeeId: practice.id,
        monthNumber: m.monthNumber,
        winnerMemberId: m.winnerMemberId ? idMap.get(m.winnerMemberId) ?? null : null,
        winningBid: m.winningBid,
        runnerUpMemberId: m.runnerUpMemberId ? idMap.get(m.runnerUpMemberId) ?? null : null,
        auctionRecordedAt: m.auctionRecordedAt,
      }))
    );

    const phones = realProfiles.filter((p) => p.phone && idMap.has(p.memberId));
    if (phones.length > 0) {
      await db.insert(memberProfiles).values(
        phones.map((p) => ({
          memberId: idMap.get(p.memberId)!,
          committeeId: practice.id,
          phone: p.phone,
        }))
      );
    }

    const links = await db
      .select()
      .from(memberGoogleAccounts)
      .where(eq(memberGoogleAccounts.committeeId, real.id))
      .catch((err) => {
        if (isLiveSchemaMissing(err)) return [];
        throw err;
      });
    const linked = links.filter((l) => idMap.has(l.memberId));
    if (linked.length > 0) {
      await db.insert(memberGoogleAccounts).values(
        linked.map((l) => ({
          memberId: idMap.get(l.memberId)!,
          committeeId: practice.id,
          googleSub: l.googleSub,
          email: l.email,
        }))
      );
    }

    if (realSettings[0]) {
      const s = realSettings[0];
      await db.insert(liveSettings).values({
        committeeId: practice.id,
        openingBid: s.openingBid,
        bidIncrement: s.bidIncrement,
        roundSeconds: s.roundSeconds,
        allowPhoneLogin: false,
      });
    }
  } catch (err) {
    await db.delete(committees).where(eq(committees.id, practice.id));
    throw err;
  }

  return practice;
}

// --- Bots ------------------------------------------------------------------

/** Deterministic 0..1 from a string, so every poll agrees on what a bot "decided". */
function roll(seed: string): number {
  const h = createHmac("sha256", "bots").update(seed).digest();
  return h.readUInt32BE(0) / 0xffffffff;
}

/**
 * Members who haven't logged in to the practice copy are played by bots.
 * Anyone who logs in (phone or invite link) takes their own seat back.
 */
export async function getBotMemberIds(practiceId: string): Promise<Set<string>> {
  const all = await getMembersForCommittee(practiceId);
  const humans = await db
    .select({ memberId: memberProfiles.memberId })
    .from(memberProfiles)
    .where(and(eq(memberProfiles.committeeId, practiceId), isNotNull(memberProfiles.lastLoginAt)));
  const humanIds = new Set(humans.map((h) => h.memberId));
  return new Set(all.filter((m) => !m.isHolder && !humanIds.has(m.id)).map((m) => m.id));
}

/** Makes the bots show up as "online" in the room. */
async function touchBots(practiceId: string, botIds: string[]): Promise<void> {
  if (botIds.length === 0) return;
  await db
    .insert(memberProfiles)
    .values(botIds.map((memberId) => ({ memberId, committeeId: practiceId, lastSeenAt: new Date() })))
    .onConflictDoUpdate({
      target: memberProfiles.memberId,
      set: { lastSeenAt: new Date() },
      setWhere: sql`${memberProfiles.lastSeenAt} is null or ${memberProfiles.lastSeenAt} < now() - interval '3 seconds'`,
    });
}

/**
 * Called on each of the host's polls while bots are switched on. There's no
 * background worker, so bots act "between polls": each bid gets a
 * pre-rolled patience, and a bot bids once that much of the fuse has burned.
 * Every session also has a pre-rolled ceiling after which the bots fold, so
 * the auction always ends (sometimes they hold out until "going twice").
 */
export async function runBots(practice: Committee, session: AuctionSession | null): Promise<void> {
  if (!isPracticeCommittee(practice)) return;
  const botIds = await getBotMemberIds(practice.id);
  await touchBots(practice.id, [...botIds]);
  if (!session || session.status !== "live") return;

  const now = Date.now();
  if (session.startsAt && session.startsAt.getTime() > now) return;

  const eligible = await getEligibleAuctionMembers(practice.id, session.monthId);
  const candidates = eligible
    .filter((m) => botIds.has(m.id) && m.id !== session.leaderMemberId)
    .map((m) => m.id);
  if (candidates.length === 0) return;

  const terms = committeeTerms(practice);
  const maxBid = computeMaxBid(terms);
  const ceilingSteps = 2 + Math.floor(roll(`${session.id}:ceiling`) * 6); // 2..7 raises
  const ceiling = session.openingBid + ceilingSteps * session.bidIncrement;
  if (session.currentBid != null && session.currentBid >= ceiling) return;

  const seed = `${session.id}:${session.bidCount}`;
  const roundMs = session.roundSeconds * 1000;
  let elapsed: number;
  if (session.bidCount === 0 || !session.roundEndsAt) {
    elapsed = now - (session.startsAt?.getTime() ?? now);
  } else {
    elapsed = roundMs - (session.roundEndsAt.getTime() - now);
  }
  // Mostly quick-ish, sometimes nail-biting.
  const patience =
    roll(`${seed}:late`) < 0.2
      ? roundMs * (0.7 + roll(`${seed}:p`) * 0.2)
      : 1500 + roll(`${seed}:p`) * Math.min(roundMs * 0.35, 8000);
  if (elapsed < patience) return;

  const bot = candidates[Math.floor(roll(`${seed}:who`) * candidates.length) % candidates.length];
  const options = jumpBidOptions(session, maxBid);
  if (options.length === 0) return;
  const amount = roll(`${seed}:jump`) < 0.2 && options.length > 1 ? options[1] : options[0];

  try {
    await placeBid(practice, bot, session.currentBid, amount);
  } catch {
    // someone (human or bot) got there first - fine, next poll
  }
}
