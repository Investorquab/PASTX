export function parseDecimalUnits(input: string, decimals: number): bigint {
  const value = input.trim();
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error("Invalid token precision.");
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error("Enter a positive decimal amount without signs or exponent notation.");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error("This amount supports at most " + decimals + " decimal places.");
  const scale = 10n ** BigInt(decimals);
  const units = BigInt(whole) * scale + (fraction.length ? BigInt(fraction.padEnd(decimals, "0") || "0") : 0n);
  if (units <= 0n) throw new Error("Amount must be greater than zero.");
  if (units >= 2n ** 256n) throw new Error("Amount exceeds uint256.");
  return units;
}
export function formatTokenUnits(value: bigint, decimals: number, digits = 4): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36 || !Number.isInteger(digits) || digits < 0 || digits > decimals) throw new Error("Invalid token precision.");
  const neg=value<0n,abs=neg?-value:value,scale=10n**BigInt(decimals),whole=abs/scale;
  if (!digits) return (neg?"-":"")+whole.toString();
  const fraction=((abs%scale)*(10n**BigInt(digits))/scale).toString().padStart(digits,"0").replace(/0+$/,"");
  return (neg?"-":"")+whole.toString()+(fraction?"."+fraction:"");
}
export function chainIdHex(id:number):string {
  if (!Number.isSafeInteger(id)||id<=0) throw new Error("Invalid chain ID.");
  return "0x"+id.toString(16);
}
