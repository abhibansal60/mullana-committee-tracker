import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Talks to a real database, so it only runs against a LOCAL Postgres
// (start one with `eval "$(scripts/test-db.sh)"`); anywhere else it's skipped.
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

  it("a member claims their name once; it then can't be picked again", async () => {
    const before = (await q.getUnclaimedMembers(committee.id)).map((m) => m.id);
    expect(before).toEqual(expect.arrayContaining(ids));
    const match = await q.claimMember(committee.id, ids[1], sub, "asha@example.com");
    expect(match.memberId).toBe(ids[1]);
    expect((await q.getUnclaimedMembers(committee.id)).map((m) => m.id)).not.toContain(ids[1]);
    expect((await q.getGoogleEmails(committee.id)).get(ids[1])).toBe("asha@example.com");
    expect((await q.findLoginsByGoogleSub(sub)).map((m) => m.memberId)).toEqual([ids[1]]);
    await expect(q.claimMember(committee.id, ids[1], `${sub}-other`, null)).rejects.toThrow(/already picked/);
  });

  it("refuses a Google account that already joined as someone else", async () => {
    await expect(q.claimMember(committee.id, ids[2], sub, null)).rejects.toThrow(/already joined as someone else/);
  });

  it("logging in creates the profile row so the join shows on the Players page", async () => {
    await q.markLoggedIn(ids[1]);
    const profile = (await q.getProfilesForCommittee(committee.id)).find((p) => p.memberId === ids[1]);
    expect(profile?.lastLoginAt).toBeTruthy();
  });

  it("the holder can rename a member, but not to a name already taken", async () => {
    expect(await q.renameMember(committee.id, ids[2], "  Bina   Devi ")).toBe("Bina Devi");
    await expect(q.renameMember(committee.id, ids[2], "asha")).rejects.toThrow(/already has that name/);
  });

  it("phone login is off unless the holder turns it on", async () => {
    await q.setMemberPhone(committee.id, ids[2], "9876500001");
    expect(await q.findLoginsByPhone("9876500001")).toEqual([]);
    expect((await q.getLiveSettings(committee)).allowPhoneLogin).toBe(false);
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
