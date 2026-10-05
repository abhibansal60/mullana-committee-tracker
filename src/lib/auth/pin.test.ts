import { describe, expect, it } from "vitest";
import {
  hashPin,
  verifyPin,
  isLockedOut,
} from "./pin";

describe("hashPin / verifyPin", () => {
  it("round-trips correctly", async () => {
    const hash = await hashPin("4821");
    expect(await verifyPin("4821", hash)).toBe(true);
    expect(await verifyPin("1234", hash)).toBe(false);
  });

  it("produces different hashes for the same PIN (salted)", async () => {
    const a = await hashPin("4821");
    const b = await hashPin("4821");
    expect(a).not.toBe(b);
  });
});

describe("isLockedOut", () => {
  it("is locked out until the expiry passes", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const expiry = new Date(now.getTime() + 60_000);
    expect(isLockedOut(expiry, now)).toBe(true);
    expect(isLockedOut(expiry, new Date(expiry.getTime() + 1))).toBe(false);
  });

  it("is not locked out when there is no lockout set", () => {
    expect(isLockedOut(null)).toBe(false);
  });
});
