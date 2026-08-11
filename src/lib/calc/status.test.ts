import { describe, expect, it } from "vitest";
import { getPaymentStatus } from "./status";

describe("getPaymentStatus", () => {
  it("returns unpaid when nothing has been paid", () => {
    expect(getPaymentStatus(1000, 0)).toBe("unpaid");
  });

  it("returns partial when less than owed has been paid", () => {
    expect(getPaymentStatus(1000, 400)).toBe("partial");
  });

  it("returns paid when exactly the owed amount has been paid", () => {
    expect(getPaymentStatus(1000, 1000)).toBe("paid");
  });

  it("returns overpaid when more than owed has been paid", () => {
    expect(getPaymentStatus(1000, 1200)).toBe("overpaid");
  });
});
