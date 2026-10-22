"use strict";

const {
  connectNative,
  contractFiles,
  dryRunConstructor,
  checkBudget,
  formatUnits,
  outputError,
  parseUnits
} = require("./common.cjs");

async function main() {
  const context = await connectNative();
  try {
    const artifacts = contractFiles("PastxDemoToken");
    const cap = parseUnits("1000000", 18);
    const quote = await dryRunConstructor(
      context,
      artifacts,
      [cap],
      "PASTX-NATIVE-PREFLIGHT-ONLY"
    );
    const budget = checkBudget(context, quote, "First contract (pUSD) deployment estimate");
    console.log(JSON.stringify({
      status: context.genesisPinned ? "native-preflight-passed-for-first-contract" : "native-preflight-passed-awaiting-genesis-pin",
      deploymentAllowed: context.genesisPinned,
      genesisPinned: context.genesisPinned,
      chain: context.chain,
      genesisHash: context.genesisHash,
      runtimeSpecVersion: context.specVersion,
      blockNumber: context.blockNumber,
      nativeAddress: context.signer.address,
      nativeBalance: formatUnits(context.free, context.decimals, 6) + " " + context.symbol,
      reservedBalance: formatUnits(context.reserved, context.decimals, 6) + " " + context.symbol,
      minimumProtectedReserve: formatUnits(budget.reserve, context.decimals, 6) + " " + context.symbol,
      firstContract: "PastxDemoToken",
      firstContractGasRequired: {
        refTime: quote.gasRequired.refTime.toString(),
        proofSize: quote.gasRequired.proofSize.toString()
      },
      estimatedExtrinsicFee: formatUnits(quote.fee, context.decimals, 8) + " " + context.symbol,
      estimatedStorageDeposit: formatUnits(quote.storageCharge, context.decimals, 8) + " " + context.symbol,
      storageDepositLimitCap: formatUnits(quote.storageDepositLimit, context.decimals, 8) + " " + context.symbol,
      balanceRemainingAfterFirstStepEstimate: formatUnits(context.spendable - quote.fee - quote.storageDepositLimit, context.decimals, 6) + " " + context.symbol,
      scopeNotice: "This dry-runs only the first contract. Later contracts depend on addresses created during deployment and will be dry-run and balance-checked immediately before each transaction.",
      transactionsSent: false,
      mnemonicPrinted: false,
      rpcEndpoint: "configured; not printed"
    }, null, 2));
  } finally {
    await context.api.disconnect();
  }
}

main().catch(error => {
  outputError(error);
  process.exitCode = 1;
});
