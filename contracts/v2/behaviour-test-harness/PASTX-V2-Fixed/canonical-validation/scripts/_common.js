const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');
const dir = path.resolve(__dirname, '../deployments');
const file = n => path.join(dir, `${n}.json`);
const read = n => fs.existsSync(file(n)) ? JSON.parse(fs.readFileSync(file(n), 'utf8')) : null;
const save = (n, x) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file(n), JSON.stringify(x, null, 2) + '\n'); };
async function chain(id) { const n = await ethers.provider.getNetwork(); if (Number(n.chainId) !== id) throw new Error(`Wrong chain: expected ${id}, connected ${n.chainId}`); }
async function deploy(name, args) {
  const f = await ethers.getContractFactory(name); const req = await f.getDeployTransaction(...args); const signer = await ethers.provider.getSigner(); const from = await signer.getAddress();
  const gas = await ethers.provider.estimateGas({ ...req, from }); const fees = await ethers.provider.getFeeData(); const price = fees.maxFeePerGas ?? fees.gasPrice;
  if (!price) throw new Error('RPC returned no gas price; refusing to deploy');
  const limit = gas * 120n / 100n; const budget = limit * price; const balance = await ethers.provider.getBalance(from);
  console.log(`${name}: signer=${from}\nestimatedGas=${gas}\ngasLimit(+20%)=${limit}\nfeeBudgetWei=${budget}\nbalanceWei=${balance}`);
  if (balance < budget) throw new Error('Insufficient balance for estimated deployment fee budget');
  const c = await f.deploy(...args, { gasLimit: limit }); const tx = c.deploymentTransaction(); console.log(`tx=${tx.hash}`); const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`${name} deployment failed`);
  return { contract: name, address: await c.getAddress(), txHash: tx.hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(), chainId: Number((await ethers.provider.getNetwork()).chainId), deployer: from, constructorArgs: args };
}
module.exports = { chain, deploy, read, save };
