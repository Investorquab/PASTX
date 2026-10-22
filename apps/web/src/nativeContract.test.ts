import { describe, expect, it } from "vitest";
import { decodeNativeCommand, encodeNativeCommand, formatNativeTpot } from "./nativeContract";

describe("native PASTX contract command codec", () => {
  it("encodes the ink! selector and SCALE arguments", () => {
    expect(encodeNativeCommand(1, 0, 0)).toBe("0xcbe8b5a5010000000000");
    expect(encodeNativeCommand(2, 3, 0x01020304)).toBe("0xcbe8b5a5020304030201");
  });

  it("decodes the returned Result tuple using little-endian u32 values", () => {
    // Ok((true, 1,000 pUSD, 3 shares, 200 pUSD))
    expect(decodeNativeCommand("0x0001e803000003000000c8000000")).toEqual({
      success: true, balance: 1_000, shares: 3, quote: 200
    });
  });

  it("preserves a contract-level rejection as success=false", () => {
    expect(decodeNativeCommand("0x0000e803000003000000c8000000").success).toBe(false);
  });

  it("rejects malformed and language-error responses", () => {
    expect(() => decodeNativeCommand("0x")).toThrow(/malformed/i);
    expect(() => decodeNativeCommand("0x01")).toThrow(/language-level/i);
    expect(() => decodeNativeCommand("0x0001")).toThrow(/incomplete/i);
    expect(() => encodeNativeCommand(4 as 0, 0, 0)).toThrow(/unsupported/i);
  });

  it("formats the native token's 14-decimal base units", () => {
    expect(formatNativeTpot(123_450_000_000_000n)).toBe("1.2345");
  });
});
