const hre = require("hardhat");
const { assertPortalTestnet, redactError } = require("./portal-network");

const MAX_PROBE_RAW = 1_000_000_000_000n; // 0.01 native token only if 14-decimal value semantics are confirmed.

async function main() {
  const prepared = await assertPortalTestnet(hre);
  const rawText = (process.env.PASTX_VALUE_PROBE_RAW || "").trim();
  if (!/^[0-9]+$/.test(rawText) || BigInt(rawText) <= 0n) {
    throw new Error("Set PASTX_VALUE_PROBE_RAW to a positive raw-unit integer for the explicit probe run. Suggested ceiling: 1000000000000 (not more than 0.01 tPOT if the 14-decimal mapping is correct).");
  }
  const amount = BigInt(rawText);
  if (amount > MAX_PROBE_RAW) throw new Error("Refusing probe value above 0.01 tPOT worth of raw units.");
  const [signer] = await hre.ethers.getSigners();
  if (signer.address.toLowerCase() !== prepared.signer.address.toLowerCase()) {
    throw new Error("Probe signer differs from the signer checked by the Portaldot preflight.");
  }

  let probe;
  let observedOk = false;
  let returnedOk = false;
  let deployTxHash = null;
  let observeTxHash = null;
  let returnTxHash = null;
  let observedRaw = null;
  let observedBalanceRaw = null;
  let returnedRaw = null;
  let returnedRecipient = null;
  let cleanupError = null;

  try {
    const factory = await hre.ethers.getContractFactory("PortalValueSemanticsProbe");
    probe = await factory.deploy();
    const deployment = probe.deploymentTransaction();
    if (!deployment) throw new Error("Probe deployment transaction was not created.");
    deployTxHash = deployment.hash;
    const deployReceipt = await deployment.wait(1);
    if (!deployReceipt || deployReceipt.status !== 1) throw new Error("Probe contract deployment failed: " + deployTxHash);
    await probe.waitForDeployment();

    const call = await probe.observeValue({ value: amount });
    observeTxHash = call.hash;
    const receipt = await call.wait(1);
    if (!receipt || receipt.status !== 1) throw new Error("Payable value-observation transaction failed: " + observeTxHash);
    const event = receipt.logs.map(log => {
      try { return probe.interface.parseLog(log); } catch { return null; }
    }).find(item => item && item.name === "ValueObserved");
    if (!event) throw new Error("ValueObserved event is missing from the successful receipt.");
    observedRaw = event.args.msgValue.toString();
    observedBalanceRaw = (await hre.ethers.provider.getBalance(await probe.getAddress())).toString();
    observedOk = BigInt(observedRaw) === amount && BigInt(observedBalanceRaw) === amount;
    if (!observedOk) {
      throw new Error("EVM value mismatch: requested=" + amount + ", msg.value=" + observedRaw + ", contractBalance=" + observedBalanceRaw + ". Do not enable iSwap/iBridge.");
    }
  } catch (error) {
    console.error("Probe observation error:", redactError(error));
  } finally {
    if (probe) {
      try {
        const balance = await hre.ethers.provider.getBalance(await probe.getAddress());
        if (balance > 0n) {
          const refund = await probe.returnAllToOwner();
          returnTxHash = refund.hash;
          const refundReceipt = await refund.wait(1);
          if (!refundReceipt || refundReceipt.status !== 1) {
            cleanupError = "Refund transaction failed: " + returnTxHash;
          } else {
            const event = refundReceipt.logs.map(log => {
              try { return probe.interface.parseLog(log); } catch { return null; }
            }).find(item => item && item.name === "ValueReturned");
            returnedRaw = event?.args.amount?.toString() ?? null;
            returnedRecipient = event?.args.recipient?.toString?.() ?? null;
            const remaining = await hre.ethers.provider.getBalance(await probe.getAddress());
            returnedOk = returnedRaw !== null && BigInt(returnedRaw) === balance && returnedRecipient?.toLowerCase() === signer.address.toLowerCase() && remaining === 0n;
            if (!returnedOk) cleanupError = "Refund did not return the full probe balance; inspect tx " + returnTxHash;
          }
        } else {
          returnedOk = true;
          returnedRaw = "0";
        }
      } catch (error) {
        cleanupError = redactError(error);
      }
    }
  }

  const output = {
    network: "Portaldot V3 EVM testnet",
    chainId: prepared.chainId.toString(),
    signer: prepared.signer.address,
    probeAddress: probe ? await probe.getAddress() : null,
    probeRaw: amount.toString(),
    displayedAsTpotIf14Decimals: hre.ethers.formatUnits(amount, 14),
    deployTxHash,
    observeTxHash,
    returnTxHash,
    observedMsgValueRaw: observedRaw,
    observedContractBalanceRaw: observedBalanceRaw,
    returnedAmountRaw: returnedRaw,
    returnedRecipient,
    valueSemanticsMatched: observedOk,
    testValueReturned: returnedOk,
    cleanupError,
    note: "A passing result supports the EVM raw-unit mapping. Confirm the official 14-decimal tPOT metadata and inspect these receipts before manually setting PASTX_PORTAL_NATIVE_VALUE_SEMANTICS_VERIFIED=true."
  };
  console.log(JSON.stringify(output, null, 2));
  if (!observedOk || !returnedOk || cleanupError) process.exitCode = 1;
}

main().catch(error => {
  console.error("PORTALDOT VALUE SEMANTICS PROBE STOPPED:", redactError(error));
  process.exitCode = 1;
});
