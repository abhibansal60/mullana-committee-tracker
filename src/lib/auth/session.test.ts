import { beforeAll, describe, expect, it } from "vitest";
import { signSession, verifySession, sessionCookieName } from "./session";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-bytes-long!!";
});

describe("signSession / verifySession", () => {
  it("round-trips a valid session", async () => {
    const token = await signSession({ sub: "committee-1", role: "admin" });
    const payload = await verifySession(token);
    expect(payload).toEqual({ sub: "committee-1", role: "admin" });
  });

  it("rejects a tampered token", async () => {
    const token = await signSession({ sub: "committee-1", role: "member" });
    const tampered = token.slice(0, -1) + (token.at(-1) === "a" ? "b" : "a");
    expect(await verifySession(tampered)).toBeNull();
  });

  it("rejects garbage input", async () => {
    expect(await verifySession("not-a-jwt")).toBeNull();
  });
});

describe("sessionCookieName", () => {
  it("namespaces by role and committee id", () => {
    expect(sessionCookieName("admin", "abc")).toBe("admin_abc");
    expect(sessionCookieName("member", "abc")).toBe("member_abc");
  });
});
