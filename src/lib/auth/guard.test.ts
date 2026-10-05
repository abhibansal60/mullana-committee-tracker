import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signSession, sessionCookieName, pinStamp } from "./session";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { value: jar.get(name)! } : undefined) }),
}));
vi.mock("@/lib/db/queries", () => ({
  getCommitteeByAdminTokenHash: vi.fn(async () => null),
  getCommitteeByMemberTokenHash: vi.fn(async () => null),
}));

const { adminGate, isAdminFor } = await import("./guard");

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-bytes-long!!";
});
beforeEach(() => jar.clear());

const c1 = { id: "c1", adminPinHash: "hash-of-pin" };
const pin = pinStamp(c1.adminPinHash);

describe("isAdminFor / adminGate", () => {
  it("accepts an admin session for this committee", async () => {
    jar.set(sessionCookieName("admin", "c1"), await signSession({ sub: "c1", role: "admin", pin }));
    expect(await isAdminFor(c1)).toBe(true);
    expect(await adminGate(c1)).toBeNull();
  });

  it("rejects a session from before a PIN change, or one with no PIN stamp", async () => {
    jar.set(sessionCookieName("admin", "c1"), await signSession({ sub: "c1", role: "admin", pin }));
    expect(await isAdminFor({ ...c1, adminPinHash: "hash-of-new-pin" })).toBe(false);
    jar.set(sessionCookieName("admin", "c1"), await signSession({ sub: "c1", role: "admin" }));
    expect(await isAdminFor(c1)).toBe(false);
  });

  it("rejects no cookie, another committee's session, and a member session", async () => {
    expect(await isAdminFor(c1)).toBe(false);
    jar.set(sessionCookieName("admin", "c1"), await signSession({ sub: "c2", role: "admin", pin }));
    expect(await isAdminFor(c1)).toBe(false);
    jar.set(sessionCookieName("admin", "c1"), await signSession({ sub: "c1", role: "member", pin }));
    expect(await isAdminFor(c1)).toBe(false);
    expect((await adminGate(c1))?.status).toBe(401);
  });
});
