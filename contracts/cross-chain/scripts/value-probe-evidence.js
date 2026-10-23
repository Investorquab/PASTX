const fs = require("node:fs");
const path = require("node:path");

function probeReportPath() {
  return path.resolve(
    process.env.PASTX_VALUE_PROBE_REPORT_PATH ||
    path.join(__dirname, "..", "deployments", "value-probe", "latest.json")
  );
}

function assertValueProbeEvidence(expectedRaw, expectedSigner) {
  const file = probeReportPath();
  if (!fs.existsSync(file)) {
    throw new Error("Missing live Portaldot value-probe report at " + file + ". Run npm run probe:native-value:portal using the same cap and review both transactions before deploying.");
  }
  let report;
  try {
    report = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error("The live Portaldot value-probe report is invalid JSON: " + file);
  }
  const expected = BigInt(expectedRaw).toString();
  if (String(report.chainId) !== "420420777") throw new Error("Value-probe report is not from Portaldot V3 EVM chain ID 420420777.");
  if (String(report.probeRaw) !== expected) throw new Error("Value-probe report raw amount must exactly match the configured iSwap/bridge cap (" + expected + "). Run the probe again with PASTX_VALUE_PROBE_RAW set to this amount.");
  if (report.valueSemanticsMatched !== true) throw new Error("Live value-semantics probe did not confirm msg.value and the contract balance matched.");
  if (report.testValueReturned !== true || String(report.returnedAmountRaw) !== expected || !report.returnTxHash) {
    throw new Error("Live value-probe report does not confirm the full probe amount was returned. Do not deploy.");
  }
  if (report.cleanupError) throw new Error("Live value-probe refund reported a cleanup error. Do not deploy.");
  if (!report.returnedRecipient || !report.signer || report.returnedRecipient.toLowerCase() !== report.signer.toLowerCase()) {
    throw new Error("Probe refund recipient does not match the recorded probe signer.");
  }
  if (expectedSigner && report.signer.toLowerCase() !== expectedSigner.toLowerCase()) {
    throw new Error("Value-probe signer does not match the Portaldot EVM deployment signer.");
  }
  return report;
}

module.exports = { assertValueProbeEvidence, probeReportPath };
