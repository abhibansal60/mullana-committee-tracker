import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Talks to a real database, so it only runs against a LOCAL Postgres
// (see scripts/README.md); anywhere else it's skipped.
try {
  process.loadEnvFile(".env.local");
} catch {}
const localDb = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");

describe.skipIf(!localDb)("Google account linking", async () => {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { committees } = await import("@/lib/db/schema");
  const { createCommittee, getMembersForCommittee } = await import("@/lib/db/queries");
  const { generateToken, sha256Hex } = await import("@/lib/auth/tokens");
  const q = await import("./queries");
  const { createPracticeCommittee, deletePracticeCommittee } = await import("./practice");

  const sub = `test-sub-${Date.now()}`;
  let committee: Awaited<ReturnType<typeof createCommittee>>;
  let ids: string[];

  beforeAll(async () => {
    process.env.AUTH_SECRET ??= "test-secret-at-least-32-bytes-long!!";
    committee = await createCommittee({
      name: `Google Link Test ${Date.now()}`,
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
    ids = (await getMembersForCommittee(committee.id)).map((m) => m.id);
  });

  afterAll(async () => {
    if (!committee) return;
    await deletePracticeCommittee(committee);
    await db.delete(committees).where(eq(committees.id, committee.id));
  });

  it("links via the invite once, then logs in by sub", async () => {
    const token = await q.issueLoginToken(committee.id, ids[1]);
    const match = await q.linkGoogleAccount(token, sub, "asha@example.com");
    expect(match?.memberId).toBe(ids[1]);
    expect(await q.linkGoogleAccount(token, sub, null)).toBeNull(); // invite used up
    expect((await q.findLoginsByGoogleSub(sub)).map((m) => m.memberId)).toEqual([ids[1]]);
  });

  it("refuses a Google account already linked to another member", async () => {
    const token = await q.issueLoginToken(committee.id, ids[2]);
    await expect(q.linkGoogleAccount(token, sub, null)).rejects.toThrow(/already linked/);
  });

  it("copies links to the practice committee, which shows up as another membership", async () => {
    const practice = await createPracticeCommittee(committee);
    const logins = await q.findLoginsByGoogleSub(sub);
    expect(logins.map((m) => m.committeeId).sort()).toEqual([committee.id, practice.id].sort());
    const others = await q.getOtherMemberships(ids[1]);
    expect(others.map((m) => m.committeeId)).toEqual([practice.id]);
  });

  it("reset unlinks Google", async () => {
    await q.revokeMemberAccess(committee.id, ids[1]);
    expect((await q.findLoginsByGoogleSub(sub)).map((m) => m.committeeId)).not.toContain(committee.id);
  });
});
