import { and, asc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "./index";
import { committees, members, months, payments } from "./schema";
import {
  computeMonthDues,
  type CommitteeTerms,
  type MonthDuesResult,
} from "@/lib/calc/dues";
import { getPaymentStatus, type PaymentStatus } from "@/lib/calc/status";

export type Committee = typeof committees.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Month = typeof months.$inferSelect;
export type Payment = typeof payments.$inferSelect;

function committeeTerms(committee: Committee): CommitteeTerms {
  return {
    memberCount: committee.memberCount,
    monthlyContribution: committee.monthlyContribution,
    runnerUpBonus: committee.runnerUpBonus,
  };
}

// --- Lookups -----------------------------------------------------------

export async function getCommitteeByAdminTokenHash(
  adminTokenHash: string
): Promise<Committee | null> {
  const rows = await db
    .select()
    .from(committees)
    .where(eq(committees.adminTokenHash, adminTokenHash))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCommitteeByMemberTokenHash(
  memberTokenHash: string
): Promise<Committee | null> {
  const rows = await db
    .select()
    .from(committees)
    .where(eq(committees.memberTokenHash, memberTokenHash))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCommitteeById(id: string): Promise<Committee | null> {
  const rows = await db
    .select()
    .from(committees)
    .where(eq(committees.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getMembersForCommittee(
  committeeId: string
): Promise<Member[]> {
  return db
    .select()
    .from(members)
    .where(eq(members.committeeId, committeeId))
    .orderBy(asc(members.sortOrder));
}

export async function getMonthsForCommittee(committeeId: string): Promise<Month[]> {
  return db
    .select()
    .from(months)
    .where(eq(months.committeeId, committeeId))
    .orderBy(asc(months.monthNumber));
}

export async function getMonthByIdWithCommittee(
  monthId: string
): Promise<{ month: Month; committee: Committee } | null> {
  const rows = await db
    .select({ month: months, committee: committees })
    .from(months)
    .innerJoin(committees, eq(months.committeeId, committees.id))
    .where(eq(months.id, monthId))
    .limit(1);
  return rows[0] ?? null;
}

// --- Committee creation --------------------------------------------------

export interface CreateCommitteeInput {
  name: string;
  monthlyContribution: number;
  durationMonths: number;
  reservedMonthNumber: number;
  runnerUpBonus: number;
  adminTokenHash: string;
  memberTokenHash: string;
  adminPinHash: string;
  memberNames: string[]; // in display order; holder identified by holderIndex
  holderIndex: number;
}

export async function createCommittee(
  input: CreateCommitteeInput
): Promise<Committee> {
  const [committee] = await db
    .insert(committees)
    .values({
      name: input.name,
      memberCount: input.memberNames.length,
      monthlyContribution: input.monthlyContribution,
      durationMonths: input.durationMonths,
      reservedMonthNumber: input.reservedMonthNumber,
      runnerUpBonus: input.runnerUpBonus,
      adminTokenHash: input.adminTokenHash,
      memberTokenHash: input.memberTokenHash,
      adminPinHash: input.adminPinHash,
    })
    .returning();

  try {
    await db.insert(members).values(
      input.memberNames.map((name, index) => ({
        committeeId: committee.id,
        name,
        isHolder: index === input.holderIndex,
        sortOrder: index,
      }))
    );

    await db.insert(months).values(
      Array.from({ length: input.durationMonths }, (_, i) => ({
        committeeId: committee.id,
        monthNumber: i + 1,
      }))
    );
  } catch (err) {
    // No multi-statement transactions on the neon-http driver: clean up the
    // orphaned committee (cascades to any members/months already inserted)
    // if a later step in this sequence fails.
    await db.delete(committees).where(eq(committees.id, committee.id));
    throw err;
  }

  return committee;
}

// --- Auction eligibility & recording -------------------------------------

/** Non-holder members who have not already won an auctioned month in this committee. */
export async function getEligibleAuctionMembers(
  committeeId: string,
  excludeMonthId?: string
): Promise<Member[]> {
  const allMembers = await getMembersForCommittee(committeeId);

  const priorWinnerRows = await db
    .select({ winnerMemberId: months.winnerMemberId })
    .from(months)
    .where(
      and(
        eq(months.committeeId, committeeId),
        isNotNull(months.winnerMemberId),
        isNotNull(months.auctionRecordedAt),
        excludeMonthId ? ne(months.id, excludeMonthId) : sql`true`
      )
    );
  const priorWinnerIds = new Set(
    priorWinnerRows.map((r) => r.winnerMemberId).filter((id): id is string => !!id)
  );

  return allMembers.filter(
    (m) => !m.isHolder && !priorWinnerIds.has(m.id)
  );
}

export interface RecordReservedAuctionInput {
  isReserved: true;
}
export interface RecordAuctionedResultInput {
  isReserved: false;
  winnerMemberId: string;
  winningBid: number;
  runnerUpMemberId: string;
}

export async function recordAuctionResult(
  monthId: string,
  input: RecordReservedAuctionInput | RecordAuctionedResultInput
): Promise<void> {
  if (input.isReserved) {
    await db
      .update(months)
      .set({
        winnerMemberId: null,
        winningBid: null,
        runnerUpMemberId: null,
        auctionRecordedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(months.id, monthId));
    return;
  }

  await db
    .update(months)
    .set({
      winnerMemberId: input.winnerMemberId,
      winningBid: input.winningBid,
      runnerUpMemberId: input.runnerUpMemberId,
      auctionRecordedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(months.id, monthId));
}

// --- Payments --------------------------------------------------------------

export async function addPayment(input: {
  monthId: string;
  memberId: string;
  amount: number;
  mode: "cash" | "upi";
  note?: string;
}): Promise<Payment> {
  const [payment] = await db
    .insert(payments)
    .values({
      monthId: input.monthId,
      memberId: input.memberId,
      amount: input.amount,
      mode: input.mode,
      note: input.note,
    })
    .returning();
  return payment;
}

export async function getPaymentWithCommitteeId(
  paymentId: string
): Promise<{ payment: Payment; committeeId: string } | null> {
  const rows = await db
    .select({ payment: payments, committeeId: months.committeeId })
    .from(payments)
    .innerJoin(months, eq(payments.monthId, months.id))
    .where(eq(payments.id, paymentId))
    .limit(1);
  return rows[0] ?? null;
}

export async function deletePayment(paymentId: string): Promise<void> {
  await db.delete(payments).where(eq(payments.id, paymentId));
}

export async function getPaymentsForMonth(monthId: string): Promise<Payment[]> {
  return db.select().from(payments).where(eq(payments.monthId, monthId));
}

// --- View models -------------------------------------------------------

export interface MemberMonthView {
  memberId: string;
  memberName: string;
  role: "winner" | "runnerUp" | "other";
  amountOwed: number;
  amountPaid: number;
  status: PaymentStatus;
  payments: Payment[];
}

export interface MonthDetail {
  month: Month;
  committee: Committee;
  isReserved: boolean;
  holderMemberId: string;
  dues: MonthDuesResult | null; // null until auction has been recorded
  members: MemberMonthView[]; // empty amountOwed/paid entries until dues is known
}

export async function getMonthDetail(monthId: string): Promise<MonthDetail | null> {
  const found = await getMonthByIdWithCommittee(monthId);
  if (!found) return null;
  const { month, committee } = found;

  const [allMembers, monthPayments] = await Promise.all([
    getMembersForCommittee(committee.id),
    getPaymentsForMonth(monthId),
  ]);

  const holder = allMembers.find((m) => m.isHolder);
  if (!holder) throw new Error(`Committee ${committee.id} has no holder`);

  const isReserved = month.monthNumber === committee.reservedMonthNumber;
  const memberIds = allMembers.map((m) => m.id);
  const nameById = new Map(allMembers.map((m) => [m.id, m.name]));

  const paidByMember = new Map<string, Payment[]>();
  for (const p of monthPayments) {
    const list = paidByMember.get(p.memberId) ?? [];
    list.push(p);
    paidByMember.set(p.memberId, list);
  }

  let dues: MonthDuesResult | null = null;
  if (month.auctionRecordedAt) {
    dues = computeMonthDues(committeeTerms(committee), memberIds, {
      isReserved,
      winnerMemberId: isReserved ? holder.id : month.winnerMemberId!,
      winningBid: isReserved ? null : month.winningBid,
      runnerUpMemberId: isReserved ? null : month.runnerUpMemberId,
    });
  }

  const membersView: MemberMonthView[] = allMembers.map((m) => {
    const due = dues?.perMember.find((d) => d.memberId === m.id);
    const memberPayments = paidByMember.get(m.id) ?? [];
    const amountPaid = memberPayments.reduce((sum, p) => sum + p.amount, 0);
    const amountOwed = due?.amountOwed ?? 0;
    return {
      memberId: m.id,
      memberName: nameById.get(m.id) ?? "Unknown",
      role: due?.role ?? "other",
      amountOwed,
      amountPaid,
      status: dues ? getPaymentStatus(amountOwed, amountPaid) : "unpaid",
      payments: memberPayments,
    };
  });

  return {
    month,
    committee,
    isReserved,
    holderMemberId: holder.id,
    dues,
    members: membersView,
  };
}

export interface MonthSummary {
  id: string;
  monthNumber: number;
  isReserved: boolean;
  auctionRecordedAt: Date | null;
  winnerName: string | null;
  winningBid: number | null;
  collectedCount: number;
  totalCount: number;
  fullyCollected: boolean;
}

export async function getMonthsSummary(
  committeeId: string
): Promise<MonthSummary[]> {
  const committee = await getCommitteeById(committeeId);
  if (!committee) return [];

  const monthRows = await db
    .select()
    .from(months)
    .where(eq(months.committeeId, committeeId))
    .orderBy(asc(months.monthNumber));

  const allMembers = await getMembersForCommittee(committeeId);
  const nameById = new Map(allMembers.map((m) => [m.id, m.name]));

  const summaries: MonthSummary[] = [];
  for (const month of monthRows) {
    if (!month.auctionRecordedAt) {
      summaries.push({
        id: month.id,
        monthNumber: month.monthNumber,
        isReserved: month.monthNumber === committee.reservedMonthNumber,
        auctionRecordedAt: null,
        winnerName: null,
        winningBid: null,
        collectedCount: 0,
        totalCount: committee.memberCount,
        fullyCollected: false,
      });
      continue;
    }

    const detail = await getMonthDetail(month.id);
    if (!detail) continue;
    const collectedCount = detail.members.filter(
      (m) => m.status === "paid" || m.status === "overpaid"
    ).length;

    const winnerId = detail.isReserved ? detail.holderMemberId : month.winnerMemberId;

    summaries.push({
      id: month.id,
      monthNumber: month.monthNumber,
      isReserved: detail.isReserved,
      auctionRecordedAt: month.auctionRecordedAt,
      winnerName: winnerId ? nameById.get(winnerId) ?? null : null,
      winningBid: month.winningBid,
      collectedCount,
      totalCount: committee.memberCount,
      fullyCollected: collectedCount === committee.memberCount,
    });
  }

  return summaries;
}

// --- Settings ------------------------------------------------------------

export async function hasAnyAuctionRecorded(committeeId: string): Promise<boolean> {
  const rows = await db
    .select({ id: months.id })
    .from(months)
    .where(and(eq(months.committeeId, committeeId), isNotNull(months.auctionRecordedAt)))
    .limit(1);
  return rows.length > 0;
}

export async function updateCommitteeSettings(
  committeeId: string,
  updates: Partial<{
    name: string;
    runnerUpBonus: number;
    reservedMonthNumber: number;
    showProfitLoss: boolean;
    adminPinHash: string;
  }>
): Promise<void> {
  await db
    .update(committees)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(committees.id, committeeId));
}

export async function regenerateMemberToken(
  committeeId: string,
  newMemberTokenHash: string
): Promise<void> {
  await db
    .update(committees)
    .set({ memberTokenHash: newMemberTokenHash, updatedAt: new Date() })
    .where(eq(committees.id, committeeId));
}

// --- PIN attempt tracking --------------------------------------------------

export async function recordFailedPinAttempt(
  committee: Committee
): Promise<{ failedAttempts: number }> {
  const failedAttempts = committee.pinFailedAttempts + 1;
  await db
    .update(committees)
    .set({ pinFailedAttempts: failedAttempts })
    .where(eq(committees.id, committee.id));
  return { failedAttempts };
}

export async function lockPin(committeeId: string, lockedUntil: Date): Promise<void> {
  await db
    .update(committees)
    .set({ pinLockedUntil: lockedUntil })
    .where(eq(committees.id, committeeId));
}

export async function resetPinAttempts(committeeId: string): Promise<void> {
  await db
    .update(committees)
    .set({ pinFailedAttempts: 0, pinLockedUntil: null })
    .where(eq(committees.id, committeeId));
}
