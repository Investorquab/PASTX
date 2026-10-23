const COMMAND_SELECTOR = "cbe8b5a5";

export type NativeDemoAction = 0 | 1 | 2 | 3;

export type NativeCommandResult = {
  success: boolean;
  balance: number;
  shares: number;
  quote: number;
};

function byteHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

/** SCALE-encode the compact ink! command selector plus (u8, u8, u32 LE). */
export function encodeNativeCommand(action: NativeDemoAction, stockId: number, quantity: number): string {
  if (!Number.isInteger(action) || action < 0 || action > 3) {
    throw new Error("Unsupported native contract action.");
  }
  if (!Number.isInteger(stockId) || stockId < 0 || stockId > 255) {
    throw new Error("Stock ID must be an integer from 0 to 255.");
  }
  if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 0xffff_ffff) {
    throw new Error("Quantity must be a non-negative 32-bit integer.");
  }

  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, quantity, true);
  return "0x" + COMMAND_SELECTOR + byteHex(action) + byteHex(stockId) +
    Array.from(bytes, byteHex).join("");
}

/** Decode the ink! Result<(bool, u32, u32, u32), LangError> returned by command(). */
export function decodeNativeCommand(outputHex: string): NativeCommandResult {
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(outputHex)) {
    throw new Error("Contract returned malformed SCALE data.");
  }
  const bytes = new Uint8Array((outputHex.slice(2).match(/.{2}/g) ?? []).map((part) => Number.parseInt(part, 16)));
  // The outer Result enum is one byte: 0 = Ok, 1 = LangError.
  if (bytes[0] !== 0) {
    throw new Error("The native contract returned a language-level error.");
  }
  if (bytes.length < 14 || bytes[1] > 1) {
    throw new Error("Contract returned an incomplete or invalid command result.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    success: bytes[1] === 1,
    balance: view.getUint32(2, true),
    shares: view.getUint32(6, true),
    quote: view.getUint32(10, true)
  };
}

export function formatNativeTpot(raw: bigint): string {
  const unit = 100_000_000_000_000n;
  const whole = raw / unit;
  const fraction = (raw % unit).toString().padStart(14, "0").slice(0, 4).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
