const { ethers, network } = require('hardhat');
async function main() {
 const expected = network.name === 'bnbTestnet' ? 97 : network.name === 'portalDotTestnet' ? 420420777 : null;
 if (!expected) throw new Error(`Use --network bnbTestnet or portalDotTestnet; got ${network.name}`);
 const n = await ethers.provider.getNetwork(); if (Number(n.chainId) !== expected) throw new Error(`Expected chain ${expected}; got ${n.chainId}`);
 const [s] = await ethers.getSigners(); const a = await s.getAddress(); const b = await ethers.provider.getBalance(a); const fee = await ethers.provider.getFeeData(); const block = await ethers.provider.getBlock('latest');
 console.log(JSON.stringify({ network: network.name, chainId: Number(n.chainId), block: block.number, deployer: a, balanceWei: b.toString(), balanceNative: ethers.formatEther(b), gasPriceWei: fee.gasPrice?.toString() || null, maxFeePerGasWei: fee.maxFeePerGas?.toString() || null, sendsTransaction: false }, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
