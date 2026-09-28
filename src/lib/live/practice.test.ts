import { beforeAll, describe, expect, it } from "vitest";
import { isPracticeCommittee, PRACTICE_PREFIX } from "./rules";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-bytes-long!!";
  process.env.DATABASE_URL ??= "postgres://unused@localhost/unused";
});

describe("practice committees", () => {
  it("are recognised by name", () => {
    expect(isPracticeCommittee({ name: `${PRACTICE_PREFIX}Mullana Committee` })).toBe(true);
    expect(isPracticeCommittee({ name: "Mullana Committee" })).toBe(false);
  });

  it("derive a stable, committee-specific admin token", async () => {
    const { practiceAdminToken } = await import("./practice");
    const a = practiceAdminToken("committee-a");
    expect(practiceAdminToken("committee-a")).toBe(a);
    expect(practiceAdminToken("committee-b")).not.toBe(a);
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
});
