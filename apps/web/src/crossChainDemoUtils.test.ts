import { describe, expect, it } from "vitest";
import { chainIdHex, formatTokenUnits, parseDecimalUnits } from "./crossChainDemoUtils";
describe("cross-chain demo amount helpers",()=>{
  it("parses exact raw units",()=>{
    expect(parseDecimalUnits("1",14)).toBe(100_000_000_000_000n);
    expect(parseDecimalUnits("0.1",14)).toBe(10_000_000_000_000n);
    expect(parseDecimalUnits("0.00000000000001",14)).toBe(1n);
    expect(parseDecimalUnits("1.2300",6)).toBe(1_230_000n);
  });
  it("rejects bad precision and unsafe amounts",()=>{
    for(const v of ["0","-1","+1","1e3",".","1."," ","0.000000000000001"]) expect(()=>parseDecimalUnits(v,14)).toThrow();
    expect(()=>parseDecimalUnits("1".repeat(78),14)).toThrow();
  });
  it("formats token units without floating-point conversion",()=>{
    expect(formatTokenUnits(12_345_678_901_234_567n,14,4)).toBe("123.4567");
    expect(formatTokenUnits(100_000_000_000_000n,14,4)).toBe("1");
    expect(formatTokenUnits(1n,14,4)).toBe("0");
  });
  it("formats wallet chain IDs",()=>{
    expect(chainIdHex(420420777)).toBe("0x190f1ca9");
    expect(chainIdHex(97)).toBe("0x61");
    expect(()=>chainIdHex(0)).toThrow();
  });
});
