import { describe, expect, it } from "vitest";
import { calculateReferenceNotional, parsePreviewQuantity } from "./orderPreview";

describe("order preview calculations", () => {
  it("calculates a reference notional without creating an order", () => {
    expect(calculateReferenceNotional("2.5", 100)).toBe(250);
  });

  it("rejects empty, zero, negative, non-finite and oversized quantities", () => {
    for (const raw of ["", " ", "0", "-1", "Infinity", "NaN", "1000001"]) {
      expect(parsePreviewQuantity(raw)).toBeNull();
      expect(calculateReferenceNotional(raw, 100)).toBeNull();
    }
  });

  it("rejects invalid reference prices and arithmetic overflow", () => {
    expect(calculateReferenceNotional("1", 0)).toBeNull();
    expect(calculateReferenceNotional("1", -10)).toBeNull();
    expect(calculateReferenceNotional("1000000", Number.MAX_VALUE)).toBeNull();
  });
});
