import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  parseAbi
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PORTALDOT_CHAIN_ID = 420420777;
const BSC_TESTNET_CHAIN_ID = 97;
const portalRpc = process.env.PORTALDOT_V3_EVM_RPC_URL || "https://test-evm-rpc-v3.portaldot.dev";
const bscRpc = process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet-dataseed.bnbchain.org";
const portalEscrowAddress = requiredAddress("PASTX_PORTALDOT_ESCROW_ADDRESS");
const bnbGatewayAddress = requiredAddress("PASTX_BNB_GATEWAY_ADDRESS");
const execute = process.env.PASTX_RELAY_EXECUTE === "true";
const portalConfirmations = positiveInteger(process.env.PASTX_PORTALDOT_CONFIRMATIONS || "3", "PASTX_PORTALDOT_CONFIRMATIONS", 100);
const bnbConfirmations = positiveInteger(process.env.PASTX_BNB_CONFIRMATIONS || "3", "PASTX_BNB_CONFIRMATIONS", 100);
const pollMs = positiveInteger(process.env.PASTX_RELAY_POLL_MS || "5000", "PASTX_RELAY_POLL_MS", 60000);
const batchSize = positiveInteger(process.env.PASTX_RELAY_BATCH_SIZE || "100", "PASTX_RELAY_BATCH_SIZE", 1000);
const portalStartBlock = requiredBlock("PASTX_PORTALDOT_SCAN_FROM_BLOCK");
const bnbStartBlock = requiredBlock("PASTX_BNB_SCAN_FROM_BLOCK");

const portalChain = defineChain({
  id: PORTALDOT_CHAIN_ID,
  name: "PortalDOT V3 Testnet",
  nativeCurrency: { name: "tPOTv3", symbol: "tPOTv3", decimals: 14 },
  rpcUrls: { default: { http: [portalRpc] } },
  testnet: true
});
const bnbChain = defineChain({
  id: BSC_TESTNET_CHAIN_ID,
  name: "BNB Smart Chain Testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: { default: { http: [bscRpc] } },
  testnet: true
});

const sourceAbi = parseAbi([
  "event DepositInitiated(bytes32 indexed depositId,address indexed sender,address indexed destinationRecipient,uint256 amount,uint256 sourceChainId,uint256 destinationChainId,uint256 nonce)",
  "function relayer() view returns (address)",
  "function destinationChainId() view returns (uint256)",
  "function processedWithdrawals(bytes32 withdrawalId) view returns (bool)",
  "function releaseWithdrawal(bytes32 withdrawalId,address recipient,uint256 amount)"
]);
const destinationAbi = parseAbi([
  "event WithdrawalRequested(bytes32 indexed withdrawalId,address indexed sender,address indexed portalRecipient,uint256 amount,uint256 nonce)",
  "function relayer() view returns (address)",
  "function expectedSourceChainId() view returns (uint256)",
  "function expectedSourceEscrow() view returns (address)",
  "function processedDepositIds(bytes32 depositId) view returns (bool)",
  "function processedSourceEvents(bytes32 sourceEventKey) view returns (bool)",
  "function completeDeposit(bytes32 depositId,address sourceSender,address recipient,uint256 amount,uint256 sourceChainId,address sourceEscrow,uint256 destinationChainId,uint256 nonce,bytes32 sourceTxHash,uint256 sourceLogIndex)"
]);

function requiredAddress(name) {
  const value = process.env[name];
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`Set ${name} to a deployed testnet contract address.`);
  }
  return getAddress(value);
}

function requiredBlock(name) {
  const value = process.env[name];
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`Set ${name} to the deployment block (or an earlier verified scan start block).`);
  }
  return BigInt(value);
}

function positiveInteger(value, name, max) {
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be an integer.`);
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw new Error(`${name} must be between 1 and ${max}.`);
  }
  return number;
}

function logJson(value) {
  console.log(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
}

async function main() {
  const portal = createPublicClient({ chain: portalChain, transport: http(portalRpc) });
  const bnb = createPublicClient({ chain: bnbChain, transport: http(bscRpc) });

  const [portalChainId, bnbChainId] = await Promise.all([portal.getChainId(), bnb.getChainId()]);
  if (portalChainId !== PORTALDOT_CHAIN_ID) throw new Error(`Wrong PortalDOT chain ID: ${portalChainId}`);
  if (bnbChainId !== BSC_TESTNET_CHAIN_ID) throw new Error(`Wrong BNB chain ID: ${bnbChainId}`);

  const [destinationChain, expectedSourceChain, expectedSourceEscrow] = await Promise.all([
    portal.readContract({ address: portalEscrowAddress, abi: sourceAbi, functionName: "destinationChainId" }),
    bnb.readContract({ address: bnbGatewayAddress, abi: destinationAbi, functionName: "expectedSourceChainId" }),
    bnb.readContract({ address: bnbGatewayAddress, abi: destinationAbi, functionName: "expectedSourceEscrow" })
  ]);
  if (destinationChain !== BigInt(BSC_TESTNET_CHAIN_ID)) throw new Error("Source escrow is not configured for BNB testnet.");
  if (expectedSourceChain !== BigInt(PORTALDOT_CHAIN_ID)) throw new Error("BNB gateway expects a different source chain.");
  if (getAddress(expectedSourceEscrow) !== portalEscrowAddress) throw new Error("BNB gateway source escrow does not match PASTX_PORTALDOT_ESCROW_ADDRESS.");

  let portalWallet;
  let bnbWallet;
  if (execute) {
    const portalKey = process.env.PASTX_PORTALDOT_RELAYER_PRIVATE_KEY;
    const bnbKey = process.env.PASTX_BNB_RELAYER_PRIVATE_KEY;
    if (!portalKey || !/^0x[0-9a-fA-F]{64}$/.test(portalKey)) {
      throw new Error("Execution requires PASTX_PORTALDOT_RELAYER_PRIVATE_KEY.");
    }
    if (!bnbKey || !/^0x[0-9a-fA-F]{64}$/.test(bnbKey)) {
      throw new Error("Execution requires PASTX_BNB_RELAYER_PRIVATE_KEY.");
    }
    const portalAccount = privateKeyToAccount(portalKey);
    const bnbAccount = privateKeyToAccount(bnbKey);
    const [sourceOperator, destinationOperator] = await Promise.all([
      portal.readContract({ address: portalEscrowAddress, abi: sourceAbi, functionName: "relayer" }),
      bnb.readContract({ address: bnbGatewayAddress, abi: destinationAbi, functionName: "relayer" })
    ]);
    if (getAddress(sourceOperator) !== getAddress(portalAccount.address)) {
      throw new Error("PortalDOT relayer key does not match the source escrow's configured relayer.");
    }
    if (getAddress(destinationOperator) !== getAddress(bnbAccount.address)) {
      throw new Error("BNB relayer key does not match the destination gateway's configured relayer.");
    }
    portalWallet = createWalletClient({ account: portalAccount, chain: portalChain, transport: http(portalRpc) });
    bnbWallet = createWalletClient({ account: bnbAccount, chain: bnbChain, transport: http(bscRpc) });
  }

  logJson({
    mode: execute ? "TESTNET EXECUTION ENABLED" : "DRY RUN — READ ONLY",
    portalChainId,
    bnbChainId,
    portalEscrowAddress,
    bnbGatewayAddress,
    portalStartBlock,
    bnbStartBlock,
    portalConfirmations,
    bnbConfirmations,
    warning: "Trusted single-relayer prototype. Never point this script at mainnet or use valuable funds."
  });

  let nextPortalBlock = portalStartBlock;
  let nextBnbBlock = bnbStartBlock;

  async function scanDeposits() {
    const latest = await portal.getBlockNumber();
    const safeHead = latest > BigInt(portalConfirmations) ? latest - BigInt(portalConfirmations) : 0n;
    while (nextPortalBlock <= safeHead) {
      const toBlock = minBigInt(safeHead, nextPortalBlock + BigInt(batchSize - 1));
      const logs = await portal.getLogs({
        address: portalEscrowAddress,
        event: parseAbi(["event DepositInitiated(bytes32 indexed depositId,address indexed sender,address indexed destinationRecipient,uint256 amount,uint256 sourceChainId,uint256 destinationChainId,uint256 nonce)"])[0],
        fromBlock: nextPortalBlock,
        toBlock
      });

      for (const log of logs) {
        const args = log.args;
        if (!args.depositId || !args.sender || !args.destinationRecipient || args.amount === undefined || args.nonce === undefined) continue;
        if (args.sourceChainId !== BigInt(PORTALDOT_CHAIN_ID) || args.destinationChainId !== BigInt(BSC_TESTNET_CHAIN_ID) || args.sender === "0x0000000000000000000000000000000000000000") {
          throw new Error(`Deposit ${args.depositId} has unexpected chain metadata.`);
        }
        if (log.transactionHash === null || log.logIndex === null) throw new Error("Source event is missing transaction evidence.");
        const receipt = await portal.getTransactionReceipt({ hash: log.transactionHash });
        if (receipt.status !== "success") throw new Error(`Source deposit transaction failed: ${log.transactionHash}`);

        const alreadyProcessed = await bnb.readContract({
          address: bnbGatewayAddress,
          abi: destinationAbi,
          functionName: "processedDepositIds",
          args: [args.depositId]
        });
        const result = {
          operation: "deposit",
          depositId: args.depositId,
          sourceTxHash: log.transactionHash,
          sourceLogIndex: log.logIndex,
          recipient: args.destinationRecipient,
          amountRaw: args.amount,
          status: alreadyProcessed ? "already-processed" : execute ? "submitting" : "dry-run-only"
        };

        if (!alreadyProcessed && execute) {
          const txHash = await bnbWallet.writeContract({
            address: bnbGatewayAddress,
            abi: destinationAbi,
            functionName: "completeDeposit",
            args: [
              args.depositId,
              args.sender,
              args.destinationRecipient,
              args.amount,
              args.sourceChainId,
              portalEscrowAddress,
              args.destinationChainId,
              args.nonce,
              log.transactionHash,
              BigInt(log.logIndex)
            ]
          });
          const destinationReceipt = await bnb.waitForTransactionReceipt({ hash: txHash });
          if (destinationReceipt.status !== "success") throw new Error(`Destination deposit completion failed: ${txHash}`);
          result.status = "completed";
          result.destinationTxHash = txHash;
        }
        logJson(result);
      }
      nextPortalBlock = toBlock + 1n;
    }
  }

  async function scanWithdrawals() {
    const latest = await bnb.getBlockNumber();
    const safeHead = latest > BigInt(bnbConfirmations) ? latest - BigInt(bnbConfirmations) : 0n;
    while (nextBnbBlock <= safeHead) {
      const toBlock = minBigInt(safeHead, nextBnbBlock + BigInt(batchSize - 1));
      const logs = await bnb.getLogs({
        address: bnbGatewayAddress,
        event: parseAbi(["event WithdrawalRequested(bytes32 indexed withdrawalId,address indexed sender,address indexed portalRecipient,uint256 amount,uint256 nonce)"])[0],
        fromBlock: nextBnbBlock,
        toBlock
      });

      for (const log of logs) {
        const args = log.args;
        if (!args.withdrawalId || !args.portalRecipient || args.amount === undefined) continue;
        if (log.transactionHash === null) throw new Error("Withdrawal event is missing transaction evidence.");
        const receipt = await bnb.getTransactionReceipt({ hash: log.transactionHash });
        if (receipt.status !== "success") throw new Error(`BNB withdrawal request failed: ${log.transactionHash}`);
        const alreadyProcessed = await portal.readContract({
          address: portalEscrowAddress,
          abi: sourceAbi,
          functionName: "processedWithdrawals",
          args: [args.withdrawalId]
        });
        const result = {
          operation: "withdrawal",
          withdrawalId: args.withdrawalId,
          sourceTxHash: log.transactionHash,
          sourceLogIndex: log.logIndex,
          recipient: args.portalRecipient,
          amountRaw: args.amount,
          status: alreadyProcessed ? "already-processed" : execute ? "submitting" : "dry-run-only"
        };

        if (!alreadyProcessed && execute) {
          const escrowBalance = await portal.getBalance({ address: portalEscrowAddress });
          if (escrowBalance < args.amount) {
            // Do not advance the block cursor past a withdrawal that the source escrow cannot currently honour.
            throw new Error(`Source escrow balance ${escrowBalance} is below requested release ${args.amount}; top up or investigate before retrying.`);
          }
          const txHash = await portalWallet.writeContract({
            address: portalEscrowAddress,
            abi: sourceAbi,
            functionName: "releaseWithdrawal",
            args: [args.withdrawalId, args.portalRecipient, args.amount]
          });
          const sourceReleaseReceipt = await portal.waitForTransactionReceipt({ hash: txHash });
          if (sourceReleaseReceipt.status !== "success") throw new Error(`PortalDOT withdrawal release failed: ${txHash}`);
          result.status = "completed";
          result.destinationTxHash = txHash;
        }
        logJson(result);
      }
      nextBnbBlock = toBlock + 1n;
    }
  }

  while (true) {
    try {
      await scanDeposits();
      await scanWithdrawals();
    } catch (error) {
      console.error("Relay poll failed; cursors remain at the unprocessed batch for safe retry:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

function minBigInt(a, b) {
  return a < b ? a : b;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
