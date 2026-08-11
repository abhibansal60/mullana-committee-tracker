import { describe, expect, it } from "vitest";
import {
  hashPin,
  verifyPin,
  shouldLock,
  computeLockoutExpiry,
  isLockedOut,
  MAX_FAILED_PIN_ATTEMPTS,
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

describe("shouldLock", () => {
  it("does not lock below the threshold", () => {
    expect(shouldLock(MAX_FAILED_PIN_ATTEMPTS - 1)).toBe(false);
  });

  it("locks at and above the threshold", () => {
    expect(shouldLock(MAX_FAILED_PIN_ATTEMPTS)).toBe(true);
    expect(shouldLock(MAX_FAILED_PIN_ATTEMPTS + 1)).toBe(true);
  });
});

describe("computeLockoutExpiry / isLockedOut", () => {
  it("is locked out immediately after computing an expiry", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const expiry = computeLockoutExpiry(now);
    expect(isLockedOut(expiry, now)).toBe(true);
  });

  it("is not locked out once the expiry has passed", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const expiry = computeLockoutExpiry(now);
    const later = new Date(expiry.getTime() + 1);
    expect(isLockedOut(expiry, later)).toBe(false);
  });

  it("is not locked out when there is no lockout set", () => {
    expect(isLockedOut(null)).toBe(false);
  });
});
