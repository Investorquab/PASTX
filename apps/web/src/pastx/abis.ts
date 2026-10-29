// Minimal ABIs for the PASTX contracts, as viem-typed const arrays.
// Only the functions/events the frontend actually uses.

export const nativeMarketAbi = [
  { type: "function", name: "buy", stateMutability: "payable", inputs: [{ name: "symbol", type: "bytes32" }, { name: "shares", type: "uint256" }], outputs: [] },
  { type: "function", name: "sell", stateMutability: "nonpayable", inputs: [{ name: "symbol", type: "bytes32" }, { name: "shares", type: "uint256" }], outputs: [] },
  { type: "function", name: "positions", stateMutability: "view", inputs: [{ name: "", type: "address" }, { name: "", type: "bytes32" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "listings", stateMutability: "view", inputs: [{ name: "", type: "bytes32" }], outputs: [{ name: "stockToken", type: "address" }, { name: "pricePerShare", type: "uint256" }, { name: "enabled", type: "bool" }] },
] as const;

export const wrappedMarketAbi = [
  { type: "function", name: "buy", stateMutability: "nonpayable", inputs: [{ name: "symbol", type: "bytes32" }, { name: "shares", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "sell", stateMutability: "nonpayable", inputs: [{ name: "symbol", type: "bytes32" }, { name: "shares", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "positions", stateMutability: "view", inputs: [{ name: "", type: "address" }, { name: "", type: "bytes32" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "listings", stateMutability: "view", inputs: [{ name: "", type: "bytes32" }], outputs: [{ name: "stockToken", type: "address" }, { name: "pricePerShare", type: "uint256" }, { name: "enabled", type: "bool" }] },
] as const;

// PastxTestStock + WrappedPot share these ERC20-ish members.
export const erc20Abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "", type: "address" }, { name: "", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export const escrowAbi = [
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [{ name: "bnbRecipient", type: "address" }], outputs: [{ name: "depositId", type: "bytes32" }] },
  { type: "function", name: "totalDeposited", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "event", name: "DepositInitiated", inputs: [
    { name: "depositId", type: "bytes32", indexed: true },
    { name: "sender", type: "address", indexed: true },
    { name: "recipient", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
    { name: "sourceChainId", type: "uint256", indexed: false },
    { name: "destinationChainId", type: "uint256", indexed: false },
    { name: "nonce", type: "uint256", indexed: false },
  ] },
] as const;

export const gatewayAbi = [
  { type: "function", name: "requestWithdrawal", stateMutability: "nonpayable", inputs: [{ name: "wrappedAmount", type: "uint256" }, { name: "portalRecipient", type: "address" }], outputs: [{ name: "withdrawalId", type: "bytes32" }] },
  { type: "function", name: "processedDepositIds", stateMutability: "view", inputs: [{ name: "", type: "bytes32" }], outputs: [{ type: "bool" }] },
  { type: "event", name: "DepositCompleted", inputs: [
    { name: "depositId", type: "bytes32", indexed: true },
    { name: "recipient", type: "address", indexed: true },
    { name: "sourceAmount", type: "uint256", indexed: false },
    { name: "wrappedAmount", type: "uint256", indexed: false },
    { name: "sourceTxHash", type: "bytes32", indexed: false },
    { name: "sourceLogIndex", type: "uint256", indexed: false },
  ] },
] as const;
