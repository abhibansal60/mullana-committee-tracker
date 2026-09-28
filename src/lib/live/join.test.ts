import { beforeAll, describe, expect, it } from "vitest";
import { joinCode, parseJoinCode } from "./join";

const id = "6f1f0b7e-3a52-4c1c-9d0e-2d6b1a9c4e11";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-bytes-long!!";
});

describe("join codes", () => {
  it("round-trips a committee id", () => {
    expect(parseJoinCode(joinCode(id))).toBe(id);
  });

  it("rejects a tampered signature, another committee's signature, and junk", () => {
    const code = joinCode(id);
    expect(parseJoinCode(code.slice(0, -1) + (code.endsWith("a") ? "b" : "a"))).toBeNull();
    const other = "7a1f0b7e-3a52-4c1c-9d0e-2d6b1a9c4e11";
    expect(parseJoinCode(`${other}.${code.split(".")[1]}`)).toBeNull();
    expect(parseJoinCode(id)).toBeNull();
    expect(parseJoinCode("nonsense.x.y")).toBeNull();
  });
});
