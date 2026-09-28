import { beforeAll, describe, expect, it } from "vitest";
import { signPlayerSession, verifyPlayerSession } from "./player";
import { signSession } from "./session";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-bytes-long!!";
});

describe("player sessions", () => {
  it("round-trips", async () => {
    const token = await signPlayerSession({ committeeId: "c1", memberId: "m1", epoch: 2 });
    expect(await verifyPlayerSession(token)).toEqual({
      committeeId: "c1",
      memberId: "m1",
      epoch: 2,
    });
  });

  it("does not accept an admin session as a player", async () => {
    const admin = await signSession({ sub: "c1", role: "admin" });
    expect(await verifyPlayerSession(admin)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifyPlayerSession("nope")).toBeNull();
  });
});
