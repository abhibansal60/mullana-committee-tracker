import { describe, expect, it } from "vitest";
import { generateToken, sha256Hex } from "./tokens";

describe("generateToken", () => {
  it("generates URL-safe tokens of sufficient length with no obvious collisions", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateToken()));
    expect(tokens.size).toBe(1000);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBeGreaterThanOrEqual(30);
    }
  });
});

describe("sha256Hex", () => {
  it("is deterministic for the same input", () => {
    const token = generateToken();
    expect(sha256Hex(token)).toBe(sha256Hex(token));
  });

  it("produces different hashes for different inputs", () => {
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });

  it("produces a 64-char lowercase hex string", () => {
    expect(sha256Hex("test")).toMatch(/^[a-f0-9]{64}$/);
  });
});
