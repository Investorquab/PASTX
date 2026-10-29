// EVM <-> Substrate account mapping for Portaldot V3 (pallet-revive).
//
// An unmapped EVM address 0x<20 bytes> is backed by the Substrate AccountId32
// formed by appending 12 bytes of 0xEE, SS58-encoded (prefix 42 on Portaldot).
// Sending native tPOT to that 5... address credits the EVM address's balance.
//
// This is deterministic: deriving the backing 5... for any 0x needs no backend
// and no on-chain lookup.
import { encodeAddress } from "@polkadot/util-crypto";
import { PORTALDOT } from "./config";

/** Backing Substrate (5...) address for an EVM address, via the 0xEE fallback mapping. */
export function evmToSubstrate(evmAddress: string, ss58Format = PORTALDOT.ss58Format): string {
  const hex = evmAddress.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(hex)) throw new Error("Invalid EVM address");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 20; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  for (let i = 20; i < 32; i++) bytes[i] = 0xee;
  return encodeAddress(bytes, ss58Format);
}

/** True if a Substrate AccountId (hex or SS58-decoded bytes) is an EVM-backed (0xEE) account. */
export function isEvmBackedAccount(accountId32Hex: string): boolean {
  const hex = accountId32Hex.toLowerCase().replace(/^0x/, "");
  return hex.length === 64 && hex.slice(40) === "ee".repeat(12);
}

/** Convert a native 14-decimal Substrate balance to the 18-decimal EVM representation. */
export function nativeToEvmUnits(native: bigint): bigint {
  return native * 10n ** BigInt(PORTALDOT.evmDecimals - PORTALDOT.nativeDecimals);
}
/** Convert an 18-decimal EVM amount to native 14-decimal Substrate units (floored). */
export function evmToNativeUnits(evm: bigint): bigint {
  return evm / 10n ** BigInt(PORTALDOT.evmDecimals - PORTALDOT.nativeDecimals);
}
