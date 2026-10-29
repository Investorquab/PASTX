const readline = require("readline");

async function confirmDeployment({ network, chainId, deployer, actions }) {
  console.log("\n=== DEPLOYMENT CONFIRMATION REQUIRED ===");
  console.log(`Network: ${network}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Deployer: ${deployer}`);
  console.log("Transactions to be sent:");
  for (const action of actions) console.log(`  - ${action}`);
  console.log("\nThis operation broadcasts real transactions and may spend testnet funds.");

  if (process.env.PASTX_CONFIRM_DEPLOYMENT !== "YES") {
    throw new Error(
      'Deployment blocked. Review the details, then set PASTX_CONFIRM_DEPLOYMENT="YES" for this invocation to proceed.'
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const answer = await new Promise(resolve =>
      rl.question('Type the exact network name to authorize: ', resolve)
    );
    if (answer.trim() !== network) {
      throw new Error("Network confirmation did not match; refusing to deploy.");
    }
  } finally {
    rl.close();
  }
}

module.exports = { confirmDeployment };
