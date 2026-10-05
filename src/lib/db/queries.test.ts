import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Talks to a real database, so it only runs against a LOCAL Postgres (see google-link.test.ts).
try {
  process.loadEnvFile(".env.local");
} catch {}
const localDb = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");

describe.skipIf(!localDb)("races the admin and the network can cause", async () => {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { committees, payments } = await import("@/lib/db/schema");
  const q = await import("./queries");
  const { generateToken, sha256Hex } = await import("@/lib/auth/tokens");
  const { MAX_FAILED_PIN_ATTEMPTS } = await import("@/lib/auth/pin");

  let committee: Awaited<ReturnType<typeof q.createCommittee>>;
  let memberIds: string[];
  let monthIds: string[];

  beforeAll(async () => {
    committee = await q.createCommittee({
      name: `Race Test ${Date.now()}`,
      monthlyContribution: 10000,
      durationMonths: 3,
      reservedMonthNumber: 1,
      runnerUpBonus: 1000,
      adminTokenHash: sha256Hex(generateToken()),
      memberTokenHash: sha256Hex(generateToken()),
      adminPinHash: "unused",
      memberNames: ["Holder", "Asha", "Bina"],
      holderIndex: 0,
    });
    memberIds = (await q.getMembersForCommittee(committee.id)).map((m) => m.id);
    monthIds = (await q.getMonthsForCommittee(committee.id)).map((m) => m.id);
  });

  afterAll(async () => {
    if (committee) await db.delete(committees).where(eq(committees.id, committee.id));
  });

  it("a burst of parallel PIN guesses still gets only the allowed number of tries", async () => {
    const claims = await Promise.all(Array.from({ length: 20 }, () => q.claimPinAttempt(committee.id)));
    expect(claims.filter(Boolean)).toHaveLength(MAX_FAILED_PIN_ATTEMPTS);
    expect(claims.filter((c) => c?.locksNow)).toHaveLength(1);
    await q.resetPinAttempts(committee.id);
    expect(await q.claimPinAttempt(committee.id)).toEqual({ locksNow: false });
    await q.resetPinAttempts(committee.id);
  });

  it("records a month's result only once", async () => {
    expect(await q.recordAuctionResult(monthIds[0], { isReserved: true })).toBe(true);
    expect(await q.recordAuctionResult(monthIds[0], { isReserved: true })).toBe(false);
  });

  it("a retried payment with the same id is saved once", async () => {
    const id = crypto.randomUUID();
    const input = { id, monthId: monthIds[1], memberId: memberIds[1], amount: 500, mode: "cash" as const };
    const [a, b] = await Promise.all([q.addPayment(input), q.addPayment(input)]);
    expect(a.id).toBe(id);
    expect(b.id).toBe(id);
    expect(await db.select().from(payments).where(eq(payments.monthId, monthIds[1]))).toHaveLength(1);
    await expect(q.addPayment({ ...input, memberId: memberIds[2] })).rejects.toThrow(/already used/);
  });
});
