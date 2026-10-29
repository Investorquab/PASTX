// Central PASTX config: live deployed addresses on Portaldot V3 + BNB testnet.
// All values can be overridden at build time via VITE_PASTX_* env vars; the
// defaults are the verified on-chain deployments (2026-10-29).
import { stringToHex } from "viem";

const env = (k: string, fallback: string): string => {
  const v = (import.meta as any).env?.[k];
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
};

export const PORTALDOT = {
  key: "portaldot" as const,
  label: "Portaldot V3",
  evmChainId: 420420777,
  evmRpc: env("VITE_PASTX_PORTALDOT_EVM_RPC_URL", "https://test-evm-rpc-v3.portaldot.dev"),
  wsRpc: env("VITE_PASTX_NATIVE_WS_RPC_URL", "wss://test-node-v3.portaldot.dev"),
  ss58Format: 42,
  // EVM layer presents 18 decimals; native Substrate balance is 14 decimals.
  evmDecimals: 18,
  nativeDecimals: 14,
  nativeSymbol: "tPOT",
  // Statescan explorer for Portaldot V3 testnet. EVM txs: /tx/<hash>; substrate
  // extrinsics: /extrinsics/<hash>; blocks: /blocks/<height|hash>.
  explorer: env("VITE_PASTX_PORTALDOT_EXPLORER", "https://scanner-testnet-v3.portaldot.dev"),
};

export const BNB = {
  key: "bnb" as const,
  label: "BNB Smart Chain Testnet",
  evmChainId: 97,
  evmRpc: env("VITE_PASTX_BSC_TESTNET_RPC_URL", "https://bsc-testnet-rpc.publicnode.com"),
  evmDecimals: 18,
  nativeSymbol: "tBNB",
  explorer: env("VITE_PASTX_BSC_TESTNET_EXPLORER", "https://testnet.bscscan.com"),
};

export const ADDRESSES = {
  portaldot: {
    market: env("VITE_PASTX_PORTAL_MARKET_ADDRESS", "0x2f85A292316f0B3385F0B5499b3490d33E958407"),
    escrow: env("VITE_PASTX_PORTALDOT_ESCROW_ADDRESS", "0x024b77EBbF04f48a0d921094f7000b18063bdD69"),
  },
  bnb: {
    gateway: env("VITE_PASTX_BNB_GATEWAY_ADDRESS", "0xd81133c76289Df27105E8aF15579631fE305F9E1"),
    wrappedPot: env("VITE_PASTX_BNB_WRAPPED_POT_ADDRESS", "0xda7C743A57b2478b801Ab12cDB1f0245b7817Fb9"),
    market: env("VITE_PASTX_BNB_MARKET_ADDRESS", "0x39f98C838273F29E1095440Eb4411AfeFC2C546c"),
  },
} as const;

export type StockListing = {
  symbol: string;        // on-chain bytes32 key source (e.g. "pAAPL")
  display: string;       // human label (e.g. "Apple")
  token: `0x${string}`;  // PastxTestStock address
  priceWei: bigint;      // price per whole share, in the market's payment token wei
  chain: "portaldot" | "bnb";
  payToken: string;      // "tPOT" or "wtPOT"
};

// bytes32 symbol key, matching ethers.encodeBytes32String used in the deploy scripts.
export const symbolKey = (symbol: string): `0x${string}` => stringToHex(symbol, { size: 32 });

export const PORTAL_LISTINGS: StockListing[] = [
  { symbol: "pAAPL", display: "Apple", token: "0x2eE620904288455e79be88cd6cf383b6685dd652", priceWei: 2_000000000000000000n, chain: "portaldot", payToken: "tPOT" },
  { symbol: "pNVDA", display: "Nvidia", token: "0x4B4535eD1825ef147c32aa58d9848e624C33C2E3", priceWei: 1_800000000000000000n, chain: "portaldot", payToken: "tPOT" },
];

export const BNB_LISTINGS: StockListing[] = [
  { symbol: "bAAPL", display: "Apple", token: "0xa4722Db67CD3C83798396aa2Ba360c0963c327a7", priceWei: 2_000000000000000000n, chain: "bnb", payToken: "wtPOT" },
  { symbol: "bNVDA", display: "Nvidia", token: "0x7592Ba534c0937061f29ec73b950bF619F8Dca41", priceWei: 1_800000000000000000n, chain: "bnb", payToken: "wtPOT" },
];

export const ALL_LISTINGS = [...PORTAL_LISTINGS, ...BNB_LISTINGS];

// Explorer / reference links for the landing page and tx receipts.
export const LINKS = {
  portaldotFaucet: env("VITE_PASTX_PORTAL_FAUCET", "https://github.com/neduojile/pot-starter-hub"),
  bscTxBase: `${BNB.explorer}/tx/`,
};

// --- Explorer link builders -------------------------------------------------
// EVM transaction (both chains use /tx/<hash>).
export const explorerTxUrl = (chain: "portaldot" | "bnb", hash: string): string =>
  `${(chain === "bnb" ? BNB.explorer : PORTALDOT.explorer).replace(/\/$/, "")}/tx/${hash}`;

// Portaldot substrate extrinsic - accepts the extrinsic hash or a `<height>-<index>` id.
export const explorerExtrinsicUrl = (hashOrId: string): string =>
  `${PORTALDOT.explorer.replace(/\/$/, "")}/extrinsics/${hashOrId}`;

// Portaldot substrate block - accepts the block hash or height.
export const explorerBlockUrl = (hashOrHeight: string | number): string =>
  `${PORTALDOT.explorer.replace(/\/$/, "")}/blocks/${hashOrHeight}`;
